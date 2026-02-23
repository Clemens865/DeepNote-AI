import { useState, useEffect, useRef, useCallback } from 'react'
import { ChatInput } from './ChatInput'
import { ChatMessage } from './ChatMessage'
import { VoiceOverlay } from './VoiceOverlay'
import { Spinner } from '../common/Spinner'
import { useNotebookStore } from '../../stores/notebookStore'
import {
  MessageSquare,
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  Table2,
  BarChart3,
  GitBranch,
  KanbanSquare,
  Gauge,
  Clock,
  Mic,
  Brain,
  ChevronDown,
} from 'lucide-react'
import type { ChatMessage as ChatMessageType, SourceType } from '@shared/types'
import { CHAT_PROVIDERS, type ChatProviderType } from '@shared/providers'

const EXT_TO_TYPE: Record<string, SourceType> = {
  pdf: 'pdf',
  docx: 'docx',
  txt: 'txt',
  md: 'md',
  mp3: 'audio',
  wav: 'audio',
  m4a: 'audio',
  ogg: 'audio',
  webm: 'audio',
}

const ARTIFACT_SHORTCUTS = [
  { icon: Table2, label: 'Table', prompt: 'Create a table summarizing the key data from my sources' },
  { icon: BarChart3, label: 'Chart', prompt: 'Create a chart visualizing the most important data from my sources' },
  { icon: GitBranch, label: 'Diagram', prompt: 'Create a mermaid diagram showing the main concepts and relationships from my sources' },
  { icon: KanbanSquare, label: 'Kanban', prompt: 'Create a kanban board with action items based on my sources' },
  { icon: Gauge, label: 'KPIs', prompt: 'Create KPI metric cards for the key performance indicators found in my sources' },
  { icon: Clock, label: 'Timeline', prompt: 'Create a timeline of the key events and milestones from my sources' },
]

// Map voice action tags to artifact prompts
const VOICE_ACTION_MAP: Record<string, string> = {
  table: ARTIFACT_SHORTCUTS[0].prompt,
  chart: ARTIFACT_SHORTCUTS[1].prompt,
  diagram: ARTIFACT_SHORTCUTS[2].prompt,
  kanban: ARTIFACT_SHORTCUTS[3].prompt,
  kpis: ARTIFACT_SHORTCUTS[4].prompt,
  timeline: ARTIFACT_SHORTCUTS[5].prompt,
}

export function ChatPanel() {
  const currentNotebook = useNotebookStore((s) => s.currentNotebook)
  const sources = useNotebookStore((s) => s.sources)
  const setSources = useNotebookStore((s) => s.setSources)
  const [messages, setMessages] = useState<ChatMessageType[]>([])
  const [sending, setSending] = useState(false)
  const [researching, setResearching] = useState(false)
  const [researchProgress, setResearchProgress] = useState<string | null>(null)
  const [uploadingFile, setUploadingFile] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [showVoice, setShowVoice] = useState(false)
  const [sbEnabled, setSbEnabled] = useState(true)
  const [chatProvider, setChatProvider] = useState<ChatProviderType>('gemini')
  const [chatModel, setChatModel] = useState('gemini-2.5-flash')
  const [providerKeys, setProviderKeys] = useState({ hasGeminiKey: false, hasClaudeKey: false, hasOpenaiKey: false, hasGroqKey: false })
  const [showModelMenu, setShowModelMenu] = useState(false)
  const modelMenuRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const researchCleanupRef = useRef<Array<() => void>>([])

  const loadMessages = useCallback(async () => {
    if (!currentNotebook) return
    const msgs = (await window.api.chatMessages(currentNotebook.id)) as ChatMessageType[]
    setMessages(msgs)
  }, [currentNotebook])

  useEffect(() => {
    loadMessages()
    // Load DeepBrain enabled state
    window.api.deepbrainStatus().then((status) => {
      if (status && typeof (status as { enabled?: boolean }).enabled === 'boolean') {
        setSbEnabled((status as { enabled: boolean }).enabled)
      }
    }).catch(() => {})
    // Load chat provider config
    window.api.getChatConfig().then((cfg: { provider: string; model: string; hasGeminiKey: boolean; hasClaudeKey: boolean; hasOpenaiKey: boolean; hasGroqKey: boolean }) => {
      setChatProvider(cfg.provider as ChatProviderType)
      setChatModel(cfg.model)
      setProviderKeys({ hasGeminiKey: cfg.hasGeminiKey, hasClaudeKey: cfg.hasClaudeKey, hasOpenaiKey: cfg.hasOpenaiKey, hasGroqKey: cfg.hasGroqKey })
    }).catch(() => {})
  }, [loadMessages])

  // Close model menu on outside click
  useEffect(() => {
    if (!showModelMenu) return
    const handleClick = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setShowModelMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showModelMenu])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    return () => {
      cleanupRef.current?.()
      researchCleanupRef.current.forEach((fn) => fn())
    }
  }, [])

  const handleSend = async (message: string) => {
    if (!currentNotebook || sending) return
    setSending(true)

    const tempUserMsg: ChatMessageType = {
      id: `temp-${Date.now()}`,
      notebookId: currentNotebook.id,
      role: 'user',
      content: message,
      citations: [],
      createdAt: new Date().toISOString(),
    }

    const streamingMsgId = `streaming-${Date.now()}`
    const streamingMsg: ChatMessageType = {
      id: streamingMsgId,
      notebookId: currentNotebook.id,
      role: 'assistant',
      content: '',
      citations: [],
      createdAt: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, tempUserMsg, streamingMsg])

    cleanupRef.current?.()
    const cleanup = window.api.onChatStreamChunk((data) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamingMsgId ? { ...m, content: m.content + data.chunk } : m
        )
      )
    })
    cleanupRef.current = cleanup

    try {
      await window.api.chatSend({
        notebookId: currentNotebook.id,
        message,
      })
      await loadMessages()
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamingMsgId
            ? {
                ...m,
                content: `Error: ${err instanceof Error ? err.message : 'Failed to send message'}`,
              }
            : m
        )
      )
    } finally {
      cleanupRef.current?.()
      cleanupRef.current = null
      setSending(false)
    }
  }

  const handleClear = async () => {
    if (!currentNotebook) return
    await window.api.chatClear(currentNotebook.id)
    setMessages([])
  }

  const handleSuggestionClick = (suggestion: string) => {
    handleSend(suggestion)
  }

  const handleDeepResearch = async () => {
    if (!currentNotebook || researching) return

    const query = prompt('What would you like to research in depth?')
    if (!query?.trim()) return

    setResearching(true)
    setResearchProgress('Starting deep research...')

    researchCleanupRef.current.forEach((fn) => fn())
    researchCleanupRef.current = []

    const progressCleanup = window.api.onDeepResearchProgress((data) => {
      setResearchProgress(data.thinking || data.status || 'Researching...')
    })
    researchCleanupRef.current.push(progressCleanup)

    const completeCleanup = window.api.onDeepResearchComplete(async (data) => {
      researchCleanupRef.current.forEach((fn) => fn())
      researchCleanupRef.current = []
      setResearching(false)
      setResearchProgress(null)

      if (data.success) {
        await loadMessages()
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            notebookId: currentNotebook.id,
            role: 'assistant',
            content: `Deep Research Error: ${data.error || 'Unknown error'}`,
            citations: [],
            createdAt: new Date().toISOString(),
          },
        ])
      }
    })
    researchCleanupRef.current.push(completeCleanup)

    try {
      await window.api.deepResearchStart({
        notebookId: currentNotebook.id,
        query: query.trim(),
      })
    } catch (err) {
      researchCleanupRef.current.forEach((fn) => fn())
      researchCleanupRef.current = []
      setResearching(false)
      setResearchProgress(null)
    }
  }

  const handleSaveToNote = async (content: string) => {
    if (!currentNotebook) return
    const title = content.slice(0, 60).replace(/[#*`\n]/g, '').trim() || 'Chat Note'
    await window.api.createNote({
      notebookId: currentNotebook.id,
      title,
      content,
    })
    setToast({ message: 'Saved as note', type: 'success' })
    setTimeout(() => setToast(null), 2000)
  }

  const handleSaveAsSource = async (content: string) => {
    if (!currentNotebook) return
    const title = content.slice(0, 60).replace(/[#*`\n]/g, '').trim() || 'AI Response'
    try {
      await window.api.addSource({
        notebookId: currentNotebook.id,
        type: 'paste',
        content,
        title: `Chat: ${title}`,
      })
      const updatedSources = await window.api.listSources(currentNotebook.id)
      setSources(updatedSources)
      setToast({ message: 'Saved as source', type: 'success' })
    } catch {
      setToast({ message: 'Failed to save as source', type: 'error' })
    }
    setTimeout(() => setToast(null), 2000)
  }

  const handleSaveToWorkspace = async (content: string) => {
    if (!currentNotebook?.workspaceRootPath) return
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    try {
      await window.api.workspaceCreateFile({
        notebookId: currentNotebook.id,
        relativePath: `ai-response-${timestamp}.md`,
        content,
      })
      setToast({ message: 'Saved to workspace', type: 'success' })
    } catch {
      setToast({ message: 'Failed to save to workspace', type: 'error' })
    }
    setTimeout(() => setToast(null), 2000)
  }

  const handleGenerateFrom = async (content: string) => {
    if (!currentNotebook) return
    try {
      await window.api.chatGenerateFromContext({
        notebookId: currentNotebook.id,
        content,
        type: 'report',
      })
      setToast({ message: 'Generated report from chat response', type: 'success' })
    } catch {
      setToast({ message: 'Generation failed', type: 'error' })
    }
    setTimeout(() => setToast(null), 3000)
  }

  const handleFileUpload = async () => {
    if (!currentNotebook || uploadingFile) return

    const filePath = await window.api.showOpenDialog({
      filters: [
        { name: 'Documents', extensions: ['pdf', 'docx', 'txt', 'md'] },
        { name: 'Audio', extensions: ['mp3', 'wav', 'm4a', 'ogg', 'webm'] },
      ],
    })

    if (!filePath) return

    const filename = filePath.split('/').pop() || filePath.split('\\').pop() || 'file'
    const ext = filename.split('.').pop()?.toLowerCase() || ''
    const sourceType = EXT_TO_TYPE[ext]

    if (!sourceType) {
      setToast({ message: `Unsupported file type: .${ext}`, type: 'error' })
      setTimeout(() => setToast(null), 3000)
      return
    }

    setUploadingFile(filename)

    try {
      await window.api.addSource({
        notebookId: currentNotebook.id,
        type: sourceType,
        filePath,
      })

      const updatedSources = await window.api.listSources(currentNotebook.id)
      setSources(updatedSources)

      setToast({ message: `${filename} added as source`, type: 'success' })
    } catch (err) {
      setToast({ message: `Failed to add ${filename}: ${err instanceof Error ? err.message : 'Unknown error'}`, type: 'error' })
    } finally {
      setUploadingFile(null)
      setTimeout(() => setToast(null), 3000)
    }
  }

  const hasSelectedSources = sources.filter((s) => s.isSelected).length > 0

  const PROVIDER_COLORS: Record<ChatProviderType, string> = {
    gemini: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400',
    claude: 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/30 text-orange-600 dark:text-orange-400',
    openai: 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30 text-green-600 dark:text-green-400',
    groq: 'bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/30 text-purple-600 dark:text-purple-400',
  }

  const hasKeyForProvider = (id: ChatProviderType) => {
    if (id === 'gemini') return providerKeys.hasGeminiKey
    if (id === 'claude') return providerKeys.hasClaudeKey
    if (id === 'openai') return providerKeys.hasOpenaiKey
    if (id === 'groq') return providerKeys.hasGroqKey
    return false
  }

  const currentProviderDef = CHAT_PROVIDERS.find((p) => p.id === chatProvider)
  const currentModelDef = currentProviderDef?.models.find((m) => m.id === chatModel)
  const modelDisplayName = currentModelDef?.name || chatModel

  const handleModelSelect = async (providerId: ChatProviderType, modelId: string) => {
    setChatProvider(providerId)
    setChatModel(modelId)
    setShowModelMenu(false)
    await window.api.setChatConfig({ provider: providerId, model: modelId })
  }

  return (
    <div className="h-full flex flex-col">
      {/* Research progress indicator */}
      {researching && researchProgress && (
        <div className="px-6 py-2 bg-indigo-50/50 dark:bg-indigo-500/[0.06] border-b border-indigo-100/50 dark:border-indigo-500/10 flex items-center gap-2">
          <Spinner size="sm" />
          <span className="text-xs text-indigo-600 dark:text-indigo-400">{researchProgress}</span>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-auto">
        <div className={`max-w-3xl mx-auto w-full px-6 py-6 ${messages.length === 0 ? 'h-full' : ''}`}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center h-full">
              <div className="w-20 h-20 bg-black/[0.03] dark:bg-white/[0.03] rounded-3xl flex items-center justify-center mx-auto mb-6 border border-black/[0.05] dark:border-white/[0.05]">
                <MessageSquare size={40} className="text-zinc-400 dark:text-zinc-500" />
              </div>
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2 tracking-tight">Ask your notebook</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto leading-relaxed mb-8">
                {sources.length === 0
                  ? "Add sources to your notebook first, then ask questions about them."
                  : "I'll answer based on your uploaded sources with citations."}
              </p>
              {sources.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center">
                  {['Summarize my sources', 'Key takeaways', 'Create a study guide'].map(
                    (suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => handleSuggestionClick(suggestion)}
                        disabled={sending}
                        className="px-4 py-2.5 rounded-full bg-white/80 dark:bg-white/[0.03] backdrop-blur-md border border-black/[0.06] dark:border-white/[0.06] text-sm text-zinc-600 dark:text-zinc-400 hover:border-black/[0.15] dark:hover:border-white/[0.15] hover:text-zinc-900 dark:hover:text-white hover:bg-white dark:hover:bg-white/[0.05] transition-all disabled:opacity-50 shadow-sm"
                      >
                        {suggestion}
                      </button>
                    )
                  )}
                </div>
              )}
              {hasSelectedSources && (
                <button
                  onClick={handleDeepResearch}
                  disabled={researching || sending}
                  className="mt-4 px-4 py-2 text-xs rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/15 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Search className="w-3.5 h-3.5" />
                  Deep Research
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  onSaveToNote={handleSaveToNote}
                  onSaveAsSource={handleSaveAsSource}
                  onSaveToWorkspace={currentNotebook?.workspaceRootPath ? handleSaveToWorkspace : undefined}
                  onGenerateFrom={handleGenerateFrom}
                  onRegenerateMermaid={(failedCode) => {
                    handleSend(
                      `The mermaid diagram you generated had a syntax error and could not be rendered. Here is the broken code:\n\n\`\`\`\n${failedCode}\n\`\`\`\n\nPlease regenerate the diagram with valid Mermaid syntax. Rules:\n- Always include graph direction (e.g. "graph TD")\n- Always quote labels: A["Label"]\n- Use --> for arrows\n- Keep node IDs alphanumeric\n- No special characters in unquoted labels`
                    )
                  }}
                />
              ))}
              {sending && messages[messages.length - 1]?.content === '' && (
                <div className="flex justify-start">
                  <div className="glass-panel rounded-2xl p-3 flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin text-indigo-500 dark:text-indigo-400" />
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">Analyzing sources...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Action bar above input */}
      {messages.length > 0 && (
        <div className="flex items-center justify-end px-6 py-1 max-w-3xl mx-auto w-full">
          <div className="flex items-center gap-2">
            {hasSelectedSources && (
              <button
                onClick={handleDeepResearch}
                disabled={researching || sending}
                className="px-3 py-1 text-xs rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/15 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                <Search className="w-3 h-3" />
                {researching ? 'Researching...' : 'Deep Research'}
              </button>
            )}
            <button
              onClick={handleClear}
              className="px-3 py-1 text-xs rounded-lg text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Model selector + Artifact shortcut chips + DeepBrain toggle */}
      <div className="flex flex-wrap items-center gap-1.5 px-6 py-1.5 max-w-3xl mx-auto w-full">
        {/* Model selector */}
        <div className="relative flex-shrink-0" ref={modelMenuRef}>
          <button
            onClick={() => setShowModelMenu(!showModelMenu)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${PROVIDER_COLORS[chatProvider]}`}
          >
            <span className="max-w-[120px] truncate">{modelDisplayName}</span>
            <ChevronDown size={10} className={`transition-transform ${showModelMenu ? 'rotate-180' : ''}`} />
          </button>

          {showModelMenu && (
            <div className="absolute bottom-full left-0 mb-1 w-64 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl rounded-xl border border-black/[0.08] dark:border-white/[0.08] shadow-xl z-50 py-1 max-h-80 overflow-y-auto">
              {CHAT_PROVIDERS.map((provider) => {
                const hasKey = hasKeyForProvider(provider.id)
                return (
                  <div key={provider.id}>
                    <div className="px-3 py-1.5 text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                      {provider.name}
                    </div>
                    {hasKey ? (
                      provider.models.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => handleModelSelect(provider.id, model.id)}
                          className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                            chatProvider === provider.id && chatModel === model.id
                              ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium'
                              : 'text-zinc-600 dark:text-zinc-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'
                          }`}
                        >
                          {model.name}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-1.5 text-[11px] text-zinc-400 dark:text-zinc-500 italic">
                        Set key in Settings
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="w-px h-4 bg-black/[0.08] dark:bg-white/[0.08] flex-shrink-0" />

        {/* DeepBrain toggle */}
        <button
          onClick={async () => {
            const newEnabled = !sbEnabled
            setSbEnabled(newEnabled)
            await window.api.deepbrainConfigure({ enabled: newEnabled })
          }}
          className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
            sbEnabled
              ? 'bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/30 text-purple-600 dark:text-purple-400'
              : 'bg-black/[0.03] dark:bg-white/[0.03] border-black/[0.06] dark:border-white/[0.06] text-zinc-400 dark:text-zinc-500'
          }`}
          title={sbEnabled ? 'DeepBrain enabled — click to disable' : 'DeepBrain disabled — click to enable'}
        >
          <Brain size={12} />
          <span className="hidden sm:inline">{sbEnabled ? 'DeepBrain' : 'DeepBrain off'}</span>
          <div className={`w-1.5 h-1.5 rounded-full ${sbEnabled ? 'bg-purple-500 animate-pulse' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
        </button>

        {hasSelectedSources && (
          <>
            <div className="w-px h-4 bg-black/[0.08] dark:bg-white/[0.08] flex-shrink-0" />
            {ARTIFACT_SHORTCUTS.map((shortcut) => (
              <button
                key={shortcut.label}
                onClick={() => handleSend(shortcut.prompt)}
                disabled={sending}
                className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-white/80 dark:bg-white/[0.03] backdrop-blur-md border border-black/[0.06] dark:border-white/[0.06] text-zinc-500 dark:text-zinc-400 hover:border-black/[0.15] dark:hover:border-white/[0.15] hover:text-zinc-900 dark:hover:text-white hover:bg-white dark:hover:bg-white/[0.05] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                <shortcut.icon size={12} />
                {shortcut.label}
              </button>
            ))}
          </>
        )}
      </div>

      {/* Voice bar (inline above input when active) */}
      {showVoice && currentNotebook && (
        <div className="flex justify-center px-6 py-1.5 max-w-3xl mx-auto w-full">
          <VoiceOverlay
            notebookId={currentNotebook.id}
            onClose={() => setShowVoice(false)}
            onUserMessage={(text) => {
              const voiceUserMsg: ChatMessageType = {
                id: `voice-user-${Date.now()}`,
                notebookId: currentNotebook.id,
                role: 'user',
                content: text,
                citations: [],
                createdAt: new Date().toISOString(),
              }
              setMessages((prev) => [...prev, voiceUserMsg])
              // Persist to DB
              window.api.chatSaveMessage({
                notebookId: currentNotebook.id,
                role: 'user',
                content: text,
              }).catch(() => {})
            }}
            onAiMessage={(text) => {
              // Detect [ACTION:type] tags and strip them from display text
              const actionMatch = text.match(/\[ACTION:(\w+)\]/i)
              const cleanText = text.replace(/\[ACTION:\w+\]/gi, '').trim()

              const voiceAiMsg: ChatMessageType = {
                id: `voice-ai-${Date.now()}`,
                notebookId: currentNotebook.id,
                role: 'assistant',
                content: cleanText,
                citations: [],
                createdAt: new Date().toISOString(),
              }
              setMessages((prev) => [...prev, voiceAiMsg])
              // Persist to DB
              window.api.chatSaveMessage({
                notebookId: currentNotebook.id,
                role: 'assistant',
                content: cleanText,
              }).catch(() => {})

              // Trigger the artifact tool if an action tag was found
              if (actionMatch) {
                const actionType = actionMatch[1].toLowerCase()
                const artifactPrompt = VOICE_ACTION_MAP[actionType]
                if (artifactPrompt) {
                  // Small delay so the voice message appears first
                  setTimeout(() => handleSend(artifactPrompt), 500)
                }
              }
            }}
          />
        </div>
      )}

      {/* Chat input with mic button */}
      <div className="flex items-end gap-2 max-w-3xl mx-auto w-full px-6">
        <div className="flex-1">
          <ChatInput onSend={handleSend} disabled={sending} onUpload={handleFileUpload} uploadingFile={uploadingFile} />
        </div>
        {!showVoice && (
          <button
            onClick={() => setShowVoice(true)}
            className="mb-3 p-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors border border-black/[0.05] dark:border-white/[0.05]"
            title="Voice Q&A"
          >
            <Mic size={18} />
          </button>
        )}
      </div>

      {/* Toast notification */}
      {toast && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg border text-sm ${
          toast.type === 'success'
            ? 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20 text-green-700 dark:text-green-400'
            : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          {toast.message}
        </div>
      )}
    </div>
  )
}
