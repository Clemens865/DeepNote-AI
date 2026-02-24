import { useState, useEffect, useCallback } from 'react'
import { Settings, Info, Brain, Server, Check, BarChart3, RotateCcw } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'
import { Spinner } from './Spinner'
import { CHAT_PROVIDERS } from '@shared/providers'
import type { TokenUsageSummary } from '@shared/types'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

type Tab = 'settings' | 'integrations' | 'usage' | 'about'

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

function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function formatCost(n: number): string {
  if (n < 0.01) return `$${n.toFixed(4)}`
  return `$${n.toFixed(2)}`
}

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
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

  // Usage state
  const [usageSummary, setUsageSummary] = useState<TokenUsageSummary | null>(null)
  const [usageLoading, setUsageLoading] = useState(false)

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

  const loadUsageSummary = useCallback(async () => {
    setUsageLoading(true)
    try {
      const summary = await window.api.getTokenUsageSummary() as TokenUsageSummary
      setUsageSummary(summary)
    } catch {
      setUsageSummary(null)
    } finally {
      setUsageLoading(false)
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

  useEffect(() => {
    if (isOpen && tab === 'usage') {
      loadUsageSummary()
    }
  }, [isOpen, tab, loadUsageSummary])

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

  const handleResetUsage = async () => {
    if (!window.confirm('Reset all usage data? This cannot be undone.')) return
    await window.api.resetTokenUsage()
    loadUsageSummary()
  }

  const tabClass = (t: Tab) =>
    `flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
      tab === t
        ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
        : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
    }`

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="">
      <div className="min-h-[420px]">
        {/* Tab bar */}
        <div className="flex gap-1 mb-5 border-b border-black/[0.06] dark:border-white/[0.06]">
          <button onClick={() => setTab('settings')} className={tabClass('settings')}>
            <Settings size={14} />
            Settings
          </button>
          <button onClick={() => setTab('integrations')} className={tabClass('integrations')}>
            <Brain size={14} />
            Integrations
          </button>
          <button onClick={() => setTab('usage')} className={tabClass('usage')}>
            <BarChart3 size={14} />
            Usage
          </button>
          <button onClick={() => setTab('about')} className={tabClass('about')}>
            <Info size={14} />
            About
          </button>
        </div>

        {tab === 'settings' && (
          <div className="space-y-4">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Configure API keys for each AI provider. Switch between models in the chat panel.
            </p>

            {CHAT_PROVIDERS.map((provider) => (
              <div key={provider.id} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-300">
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
                    className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 dark:focus:border-indigo-500/50"
                  />
                  <button
                    onClick={() => handleSaveKey(provider.id)}
                    disabled={!providerKeys[provider.id]?.trim() || providerKeys[provider.id] === '••••••••'}
                    className="px-3 py-2 text-xs font-medium rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-100 dark:hover:bg-indigo-500/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Save
                  </button>
                </div>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
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
            {sbStatus?.available ? (
              /* Full integration UI when DeepBrain is connected (for testing) */
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Brain size={16} className={sbStatus?.enabled !== false ? 'text-purple-500' : 'text-zinc-400'} />
                    <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">DeepBrain</h4>
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
                        sbStatus?.enabled !== false ? 'bg-purple-500' : 'bg-zinc-300 dark:bg-zinc-600'
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
                      <div className={`flex items-center gap-1.5 text-xs ${sbStatus?.available && sbStatus?.enabled !== false ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400 dark:text-zinc-500'}`}>
                        <div className={`w-2 h-2 rounded-full ${sbStatus?.available && sbStatus?.enabled !== false ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
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

                <div className="grid grid-cols-2 gap-2">
                  <div className="px-3 py-2 rounded-lg bg-purple-50 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-500/20">
                    <p className="text-[10px] text-purple-500 dark:text-purple-400 uppercase tracking-wide">Memories</p>
                    <p className="text-lg font-bold text-purple-700 dark:text-purple-300">{sbStatus.memoryCount.toLocaleString()}</p>
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-purple-50 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-500/20">
                    <p className="text-[10px] text-purple-500 dark:text-purple-400 uppercase tracking-wide">Indexed Files</p>
                    <p className="text-lg font-bold text-purple-700 dark:text-purple-300">{sbStatus.indexedFiles.toLocaleString()}</p>
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.04]">
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">AI Provider</p>
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{sbStatus.aiProvider}</p>
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.04]">
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Embeddings</p>
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{sbStatus.embeddingProvider}</p>
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.04] col-span-2">
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Learning Trend</p>
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200 capitalize">{sbStatus.learningTrend}</p>
                  </div>
                </div>
              </div>
            ) : (
              /* "Coming Soon" teaser when DeepBrain is not available */
              <div className="px-4 py-4 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/[0.05]">
                <div className="flex items-center gap-2 mb-2">
                  <Brain size={16} className="text-purple-400 dark:text-purple-500" />
                  <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">DeepBrain</h4>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400 font-medium">Coming Soon</span>
                </div>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed">
                  System-wide memory, file indexing, email search, clipboard history, and cross-app AI context.
                  DeepBrain will connect your operating system to your notebooks for a seamless AI experience.
                </p>
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-black/[0.04] dark:border-white/[0.04]" />

            {/* DeepNote API */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Server size={16} className="text-indigo-500" />
                  <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">DeepNote API</h4>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Listening
                </div>
              </div>

              <div className="px-3 py-2 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.04]">
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">Endpoint</p>
                <code className="text-xs text-indigo-600 dark:text-indigo-400 font-mono">
                  http://127.0.0.1:{dnApiPort || 19520}
                </code>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1.5 leading-relaxed">
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

        {tab === 'usage' && (
          <div className="space-y-4">
            {usageLoading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner size="sm" />
              </div>
            ) : usageSummary ? (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="px-3 py-2.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20">
                    <p className="text-[10px] text-blue-500 dark:text-blue-400 uppercase tracking-wide">Input Tokens</p>
                    <p className="text-lg font-bold text-blue-700 dark:text-blue-300 font-mono">{formatTokenCount(usageSummary.totalInputTokens)}</p>
                  </div>
                  <div className="px-3 py-2.5 rounded-lg bg-purple-50 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-500/20">
                    <p className="text-[10px] text-purple-500 dark:text-purple-400 uppercase tracking-wide">Output Tokens</p>
                    <p className="text-lg font-bold text-purple-700 dark:text-purple-300 font-mono">{formatTokenCount(usageSummary.totalOutputTokens)}</p>
                  </div>
                  <div className="px-3 py-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20">
                    <p className="text-[10px] text-emerald-500 dark:text-emerald-400 uppercase tracking-wide">Est. Cost</p>
                    <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300 font-mono">{formatCost(usageSummary.totalEstimatedCost)}</p>
                  </div>
                </div>

                {/* Per-provider breakdown */}
                {Object.keys(usageSummary.byProvider).length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">By Provider</h4>
                    <div className="rounded-lg border border-black/[0.06] dark:border-white/[0.06] overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-black/[0.02] dark:bg-white/[0.02]">
                            <th className="text-left px-3 py-1.5 font-medium text-zinc-500 dark:text-zinc-400">Provider</th>
                            <th className="text-right px-3 py-1.5 font-medium text-zinc-500 dark:text-zinc-400">Calls</th>
                            <th className="text-right px-3 py-1.5 font-medium text-zinc-500 dark:text-zinc-400">Input</th>
                            <th className="text-right px-3 py-1.5 font-medium text-zinc-500 dark:text-zinc-400">Output</th>
                            <th className="text-right px-3 py-1.5 font-medium text-zinc-500 dark:text-zinc-400">Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(usageSummary.byProvider).map(([provider, data]) => (
                            <tr key={provider} className="border-t border-black/[0.04] dark:border-white/[0.04]">
                              <td className="px-3 py-1.5 font-medium text-zinc-700 dark:text-zinc-200 capitalize">{provider}</td>
                              <td className="px-3 py-1.5 text-right text-zinc-500 dark:text-zinc-400 font-mono">{data.calls}</td>
                              <td className="px-3 py-1.5 text-right text-zinc-500 dark:text-zinc-400 font-mono">{formatTokenCount(data.input)}</td>
                              <td className="px-3 py-1.5 text-right text-zinc-500 dark:text-zinc-400 font-mono">{formatTokenCount(data.output)}</td>
                              <td className="px-3 py-1.5 text-right text-zinc-600 dark:text-zinc-300 font-mono">{formatCost(data.cost)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Recent calls */}
                {usageSummary.recentCalls.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Recent Calls</h4>
                    <div className="max-h-44 overflow-y-auto rounded-lg border border-black/[0.06] dark:border-white/[0.06]">
                      {usageSummary.recentCalls.slice(0, 20).map((call) => (
                        <div
                          key={call.id}
                          className="flex items-center gap-2 px-3 py-1.5 text-[11px] border-b border-black/[0.03] dark:border-white/[0.03] last:border-b-0"
                        >
                          <span className="text-zinc-400 dark:text-zinc-500 w-14 shrink-0">{timeAgo(call.timestamp)}</span>
                          <span className="text-indigo-600 dark:text-indigo-400 truncate w-32 shrink-0">{call.feature}</span>
                          <span className="text-zinc-400 dark:text-zinc-500 truncate w-28 shrink-0">{call.model}</span>
                          <span className="text-zinc-500 dark:text-zinc-400 font-mono text-right w-12 shrink-0">{formatTokenCount(call.inputTokens)}</span>
                          <span className="text-zinc-400 dark:text-zinc-500">/</span>
                          <span className="text-zinc-500 dark:text-zinc-400 font-mono w-12 shrink-0">{formatTokenCount(call.outputTokens)}</span>
                          <span className="text-zinc-600 dark:text-zinc-300 font-mono ml-auto">{formatCost(call.estimatedCost)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {usageSummary.recentCalls.length === 0 && (
                  <p className="text-sm text-zinc-400 dark:text-zinc-500 text-center py-8">
                    No API calls recorded yet. Start chatting or generating content to see usage data.
                  </p>
                )}

                {/* Reset + Close */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleResetUsage}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <RotateCcw size={12} />
                    Reset Usage Data
                  </button>
                  <div className="flex-1" />
                  <Button variant="ghost" onClick={onClose}>
                    Close
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-zinc-400 dark:text-zinc-500 text-center py-8">
                Unable to load usage data.
              </p>
            )}
          </div>
        )}

        {tab === 'about' && (
          <div className="space-y-5">
            {/* App info */}
            <div className="text-center">
              <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">DeepNote AI</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">v2.0.0</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-2 leading-relaxed">
                AI-powered notebook with document analysis, RAG chat, studio content generation, voice Q&A, and cross-session memory. Powered by Google Gemini.
              </p>
            </div>

            {/* Features grid */}
            <div>
              <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Key Features</h4>
              <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-1">
                {FEATURES.map((f) => (
                  <div
                    key={f.label}
                    className="px-2.5 py-1.5 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.04]"
                  >
                    <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">{f.label}</p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-tight">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Tech info */}
            <div className="flex items-center justify-between text-[10px] text-zinc-400 dark:text-zinc-500 pt-2 border-t border-black/[0.04] dark:border-white/[0.04]">
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
