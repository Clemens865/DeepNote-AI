import { useState, useEffect, useRef, useCallback } from 'react'
import { ChatInput } from './ChatInput'
import { ChatMessage } from './ChatMessage'
import { Spinner } from '../common/Spinner'
import { useNotebookStore } from '../../stores/notebookStore'
import { MessageSquare, Search, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import type { ChatMessage as ChatMessageType, SourceType } from '@shared/types'

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
  }, [loadMessages])

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

  return (
    <div className="h-full flex flex-col">
      {/* Research progress indicator */}
      {researching && researchProgress && (
        <div className="px-6 py-2 bg-indigo-50 dark:bg-indigo-500/10 border-b border-indigo-100 dark:border-indigo-500/20 flex items-center gap-2">
          <Spinner size="sm" />
          <span className="text-xs text-indigo-600 dark:text-indigo-400">{researchProgress}</span>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-auto">
        <div className={`max-w-3xl mx-auto w-full px-6 py-6 ${messages.length === 0 ? 'h-full' : ''}`}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center h-full">
              <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-500/15 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                <MessageSquare size={40} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Ask your notebook</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed mb-8">
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
                        className="px-4 py-2.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:text-indigo-600 dark:hover:text-indigo-400 hover:shadow-sm transition-all disabled:opacity-50"
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
                <ChatMessage key={msg.id} message={msg} onSaveToNote={handleSaveToNote} />
              ))}
              {sending && messages[messages.length - 1]?.content === '' && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-slate-800 rounded-xl p-3 flex items-center gap-2 border border-slate-200 dark:border-slate-700 shadow-sm">
                    <Loader2 size={14} className="animate-spin text-indigo-600 dark:text-indigo-400" />
                    <span className="text-xs text-slate-500 dark:text-slate-400">Analyzing sources...</span>
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
              className="px-3 py-1 text-xs rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Chat input */}
      <ChatInput onSend={handleSend} disabled={sending} onUpload={handleFileUpload} uploadingFile={uploadingFile} />

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
