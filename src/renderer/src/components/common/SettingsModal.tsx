import { useState, useEffect, useCallback } from 'react'
import { Settings, Info, Brain, Server, Check } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'
import { Spinner } from './Spinner'
import { CHAT_PROVIDERS } from '@shared/providers'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

type Tab = 'settings' | 'integrations' | 'about'

interface DeepBrainStatus {
  available: boolean
  enabled: boolean
  memoryCount: number
  thoughtCount: number
  aiProvider: string
  embeddingProvider: string
  learningTrend: string
  indexedFiles: number
}

const FEATURES = [
  { label: 'Agentic RAG', desc: 'Multi-query retrieval with AI-reasoned sub-queries' },
  { label: 'Multi-Agent Pipeline', desc: 'Research → Write → Review for studio content' },
  { label: 'AI Output Validation', desc: 'JSON validation with automatic retry' },
  { label: 'Cross-Session Memory', desc: 'AI remembers your preferences across chats' },
  { label: 'Voice Q&A', desc: 'Speak to your sources with mic input and TTS responses' },
  { label: 'Chat-to-Source', desc: 'Save AI responses as notes, sources, or workspace files' },
  { label: 'Smart Recommendations', desc: 'Cross-notebook source recommendations' },
  { label: 'Clipboard Quick-Capture', desc: 'Cmd+Shift+N global shortcut via system tray' },
  { label: 'Tiered Embeddings', desc: 'Local ONNX → Gemini API → hash fallback' },
  { label: '6 Interactive Artifacts', desc: 'Tables, charts, diagrams, kanban, KPIs, timelines' },
  { label: 'Image Slide Decks', desc: '6 visual styles, drag-and-drop editor, fullscreen presenter' },
  { label: 'AI Podcasts', desc: 'Multi-speaker audio with 4 format styles' },
  { label: 'Deep Research', desc: 'Multi-step analysis with progress updates' },
  { label: 'Workspace', desc: 'File browser, editor, AI rewrite, .gitignore support' },
]

const PROVIDER_KEY_MAP: Record<string, string> = {
  gemini: 'geminiKey',
  claude: 'claudeKey',
  openai: 'openaiKey',
  groq: 'groqKey',
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [tab, setTab] = useState<Tab>('settings')
  const [apiKey, setApiKey] = useState('')
  const [providerKeys, setProviderKeys] = useState<Record<string, string>>({
    gemini: '',
    claude: '',
    openai: '',
    groq: '',
  })
  const [savedKeys, setSavedKeys] = useState<Record<string, boolean>>({})
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)

  // DeepBrain state
  const [sbStatus, setSbStatus] = useState<DeepBrainStatus | null>(null)
  const [sbLoading, setSbLoading] = useState(false)
  const [dnApiPort, setDnApiPort] = useState<number | null>(null)

  const loadDeepBrainStatus = useCallback(async () => {
    setSbLoading(true)
    try {
      const status = await window.api.deepbrainStatus() as DeepBrainStatus | null
      setSbStatus(status)
      const apiStatus = await window.api.deepnoteApiStatus() as { port: number }
      setDnApiPort(apiStatus.port)
    } catch {
      setSbStatus(null)
    } finally {
      setSbLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      // Load Gemini key (backward compat)
      window.api.getApiKey().then((key: string) => {
        setApiKey(key || '')
        setProviderKeys((prev) => ({ ...prev, gemini: key || '' }))
      })
      // Load chat config for key presence flags — we can't retrieve raw keys for non-Gemini providers,
      // so we just show a placeholder when a key is already set
      window.api.getChatConfig().then((cfg: { hasGeminiKey: boolean; hasClaudeKey: boolean; hasOpenaiKey: boolean; hasGroqKey: boolean }) => {
        setProviderKeys((prev) => ({
          ...prev,
          claude: cfg.hasClaudeKey ? '••••••••' : '',
          openai: cfg.hasOpenaiKey ? '••••••••' : '',
          groq: cfg.hasGroqKey ? '••••••••' : '',
        }))
      }).catch(() => {})
      setSavedKeys({})
      setTestResult(null)
      loadDeepBrainStatus()
    }
  }, [isOpen, loadDeepBrainStatus])

  const handleSaveKey = async (providerId: string) => {
    const value = providerKeys[providerId]
    if (!value || value === '••••••••') return
    if (providerId === 'gemini') {
      await window.api.setApiKey(value)
      setApiKey(value)
    }
    const keyField = PROVIDER_KEY_MAP[providerId]
    if (keyField) {
      await window.api.setChatConfig({ [keyField]: value })
    }
    setSavedKeys((prev) => ({ ...prev, [providerId]: true }))
    setTimeout(() => setSavedKeys((prev) => ({ ...prev, [providerId]: false })), 2000)
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await window.api.testApiKey(providerKeys.gemini || apiKey) as { success: boolean; error?: string }
      setTestResult(result)
    } catch {
      setTestResult({ success: false, error: 'Connection failed' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="">
      <div className="min-h-[420px]">
        {/* Tab bar */}
        <div className="flex gap-1 mb-5 border-b border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setTab('settings')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'settings'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Settings size={14} />
            Settings
          </button>
          <button
            onClick={() => setTab('integrations')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'integrations'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Brain size={14} />
            Integrations
          </button>
          <button
            onClick={() => setTab('about')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'about'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Info size={14} />
            About
          </button>
        </div>

        {tab === 'settings' && (
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Configure API keys for each AI provider. Switch between models in the chat panel.
            </p>

            {CHAT_PROVIDERS.map((provider) => (
              <div key={provider.id} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">
                    {provider.name}
                  </label>
                  {provider.id === 'gemini' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30">
                      Required for Studio, Voice, Slides
                    </span>
                  )}
                  {savedKeys[provider.id] && (
                    <span className="flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400">
                      <Check size={10} /> Saved
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={providerKeys[provider.id] || ''}
                    onChange={(e) => {
                      setProviderKeys((prev) => ({ ...prev, [provider.id]: e.target.value }))
                      setSavedKeys((prev) => ({ ...prev, [provider.id]: false }))
                    }}
                    onFocus={() => {
                      // Clear placeholder when user focuses
                      if (providerKeys[provider.id] === '••••••••') {
                        setProviderKeys((prev) => ({ ...prev, [provider.id]: '' }))
                      }
                    }}
                    placeholder={provider.keyPlaceholder}
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 dark:focus:border-indigo-500/50"
                  />
                  <button
                    onClick={() => handleSaveKey(provider.id)}
                    disabled={!providerKeys[provider.id]?.trim() || providerKeys[provider.id] === '••••••••'}
                    className="px-3 py-2 text-xs font-medium rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-100 dark:hover:bg-indigo-500/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Save
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                  Get your key from{' '}
                  <span className="text-indigo-600 dark:text-indigo-400">{provider.keyUrl}</span>
                </p>
              </div>
            ))}

            {/* Gemini test section */}
            {testResult && (
              <div
                className={`px-3 py-2 rounded-lg text-sm ${
                  testResult.success
                    ? 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-500/20'
                    : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20'
                }`}
              >
                {testResult.success
                  ? 'Gemini API key is valid!'
                  : `Invalid Gemini key: ${testResult.error || 'Unknown error'}`}
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <Button variant="secondary" onClick={handleTest} disabled={!providerKeys.gemini?.trim() || providerKeys.gemini === '••••••••' || testing}>
                {testing ? (
                  <span className="flex items-center gap-2">
                    <Spinner size="sm" /> Testing Gemini...
                  </span>
                ) : (
                  'Test Gemini Key'
                )}
              </Button>
              <div className="flex-1" />
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )}

        {tab === 'integrations' && (
          <div className="space-y-5">
            {/* DeepBrain */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Brain size={16} className={sbStatus?.enabled !== false ? 'text-purple-500' : 'text-slate-400'} />
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">DeepBrain</h4>
                </div>
                <div className="flex items-center gap-2">
                  {/* Enable/Disable toggle */}
                  <button
                    onClick={async () => {
                      const newEnabled = !(sbStatus?.enabled !== false)
                      await window.api.deepbrainConfigure({ enabled: newEnabled })
                      setSbStatus((prev) => prev ? { ...prev, enabled: newEnabled } : prev)
                    }}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      sbStatus?.enabled !== false ? 'bg-purple-500' : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                    title={sbStatus?.enabled !== false ? 'Disable DeepBrain' : 'Enable DeepBrain'}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        sbStatus?.enabled !== false ? 'translate-x-[18px]' : 'translate-x-[3px]'
                      }`}
                    />
                  </button>
                  {sbLoading ? (
                    <Spinner size="sm" />
                  ) : (
                    <div className={`flex items-center gap-1.5 text-xs ${sbStatus?.available && sbStatus?.enabled !== false ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                      <div className={`w-2 h-2 rounded-full ${sbStatus?.available && sbStatus?.enabled !== false ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'}`} />
                      {sbStatus?.enabled === false ? 'Disabled' : sbStatus?.available ? 'Connected' : 'Not connected'}
                    </div>
                  )}
                  <button
                    onClick={loadDeepBrainStatus}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              {sbStatus?.available ? (
                <div className="grid grid-cols-2 gap-2">
                  <div className="px-3 py-2 rounded-lg bg-purple-50 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-500/20">
                    <p className="text-[10px] text-purple-500 dark:text-purple-400 uppercase tracking-wide">Memories</p>
                    <p className="text-lg font-bold text-purple-700 dark:text-purple-300">{sbStatus.memoryCount.toLocaleString()}</p>
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-purple-50 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-500/20">
                    <p className="text-[10px] text-purple-500 dark:text-purple-400 uppercase tracking-wide">Indexed Files</p>
                    <p className="text-lg font-bold text-purple-700 dark:text-purple-300">{sbStatus.indexedFiles.toLocaleString()}</p>
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">AI Provider</p>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{sbStatus.aiProvider}</p>
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Embeddings</p>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{sbStatus.embeddingProvider}</p>
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 col-span-2">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Learning Trend</p>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 capitalize">{sbStatus.learningTrend}</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
                  DeepBrain provides system-wide memory, file indexing, clipboard history, and local LLM integration.
                  Start DeepBrain to enable OS-level AI features.
                </p>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-slate-100 dark:border-slate-700" />

            {/* DeepNote API */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Server size={16} className="text-indigo-500" />
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">DeepNote API</h4>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Listening
                </div>
              </div>

              <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Endpoint</p>
                <code className="text-xs text-indigo-600 dark:text-indigo-400 font-mono">
                  http://127.0.0.1:{dnApiPort || 19520}
                </code>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 leading-relaxed">
                  DeepBrain, shell scripts, Raycast, and other tools can query your notebooks via this API.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )}

        {tab === 'about' && (
          <div className="space-y-5">
            {/* App info */}
            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">DeepNote AI</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">v2.0.0</p>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                AI-powered notebook with document analysis, RAG chat, studio content generation, voice Q&A, and cross-session memory. Powered by Google Gemini.
              </p>
            </div>

            {/* Features grid */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Key Features</h4>
              <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-1">
                {FEATURES.map((f) => (
                  <div
                    key={f.label}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700"
                  >
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{f.label}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Tech info */}
            <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-700">
              <span>Electron + React + Gemini AI</span>
              <span>SQLite + Drizzle ORM</span>
            </div>

            <div className="flex justify-end pt-1">
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
