import { useState, useEffect, useCallback } from 'react'
import { Database, Key, Shield, Zap, Check, ChevronRight, ExternalLink, Loader2 } from 'lucide-react'

interface SetupWizardProps {
  onComplete: () => void
}

type Step = 'welcome' | 'apiKey' | 'knowledge' | 'permissions' | 'ready'
const STEPS: Step[] = ['welcome', 'apiKey', 'knowledge', 'permissions', 'ready']

interface PermissionState {
  fullDisk: boolean
  accessibility: boolean
  mail: boolean
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState<Step>('welcome')
  const [apiKey, setApiKey] = useState('')
  const [testing, setTesting] = useState(false)
  const [keyValid, setKeyValid] = useState<boolean | null>(null)
  const [keyError, setKeyError] = useState<string | null>(null)
  const [knowledgeReady, setKnowledgeReady] = useState(false)
  const [memoryCount, setMemoryCount] = useState(0)
  const [permissions, setPermissions] = useState<PermissionState>({
    fullDisk: false,
    accessibility: false,
    mail: false,
  })

  const stepIndex = STEPS.indexOf(step)

  const next = () => {
    const nextIdx = stepIndex + 1
    if (nextIdx < STEPS.length) {
      setStep(STEPS[nextIdx])
    }
  }

  const prev = () => {
    const prevIdx = stepIndex - 1
    if (prevIdx >= 0) {
      setStep(STEPS[prevIdx])
    }
  }

  // Test API key
  const handleTestKey = async () => {
    if (!apiKey.trim()) return
    setTesting(true)
    setKeyValid(null)
    setKeyError(null)
    try {
      await window.api.setApiKey(apiKey.trim())
      const result = (await window.api.testApiKey(apiKey.trim())) as {
        success: boolean
        error?: string
      }
      setKeyValid(result.success)
      if (!result.success) setKeyError(result.error || 'Invalid key')
    } catch {
      setKeyValid(false)
      setKeyError('Connection failed')
    } finally {
      setTesting(false)
    }
  }

  // Check knowledge store on knowledge step (always ready since it's built-in)
  const checkKnowledge = useCallback(async () => {
    try {
      const status = await window.api.knowledgeStatus()
      setKnowledgeReady(true)
      setMemoryCount(status?.total ?? 0)
    } catch {
      // Knowledge store is built-in, always ready
      setKnowledgeReady(true)
    }
  }, [])

  useEffect(() => {
    if (step === 'knowledge') {
      checkKnowledge()
    }
    return undefined
  }, [step, checkKnowledge])

  // Check permissions periodically
  useEffect(() => {
    if (step === 'permissions') {
      const checkKnowledgeFolders = async () => {
        try {
          const status = await window.api.knowledgeStatus()
          if (status && status.total > 0) {
            setPermissions((p) => ({ ...p, fullDisk: true }))
          }
        } catch {
          // ignore
        }
      }
      checkKnowledgeFolders()
      const interval = setInterval(checkKnowledgeFolders, 3000)
      return () => clearInterval(interval)
    }
    return undefined
  }, [step])

  // Final step: save onboarded flag and complete
  const handleFinish = async () => {
    onComplete()
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-zinc-950 dark:to-indigo-950/30 flex items-center justify-center z-50">
      <div className="w-full max-w-lg mx-4">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`w-2 h-2 rounded-full transition-all ${
                i === stepIndex
                  ? 'bg-indigo-500 w-6'
                  : i < stepIndex
                    ? 'bg-indigo-400'
                    : 'bg-zinc-300 dark:bg-zinc-700'
              }`}
            />
          ))}
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-black/[0.05] dark:border-white/[0.05] p-8">
          {/* Welcome */}
          {step === 'welcome' && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Database size={32} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  Welcome to DeepNote AI
                </h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-3 leading-relaxed max-w-sm mx-auto">
                  Your AI-powered notebook with system-wide memory. Create research notebooks,
                  generate content, and let your computer learn from your work.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { icon: '📓', label: 'AI Notebooks' },
                  { icon: '🧠', label: 'Memory Engine' },
                  { icon: '🎨', label: 'Studio Content' },
                ].map((f) => (
                  <div
                    key={f.label}
                    className="px-3 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800"
                  >
                    <span className="text-xl">{f.icon}</span>
                    <p className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300 mt-1">
                      {f.label}
                    </p>
                  </div>
                ))}
              </div>

              <button
                onClick={next}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-medium transition-colors"
              >
                Get Started
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* API Key */}
          {step === 'apiKey' && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
                  <Key size={20} className="text-amber-500" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                    Connect AI
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Required for chat, content generation, and voice
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Google Gemini API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value)
                    setKeyValid(null)
                    setKeyError(null)
                  }}
                  placeholder="AIzaSy..."
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 placeholder:text-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                />
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                  Free at{' '}
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      window.open('https://aistudio.google.com/apikey', '_blank')
                    }}
                    className="text-indigo-500 hover:underline inline-flex items-center gap-0.5"
                  >
                    aistudio.google.com <ExternalLink size={10} />
                  </a>{' '}
                  &mdash; takes 2 minutes
                </p>
              </div>

              {keyValid !== null && (
                <div
                  className={`px-3 py-2 rounded-lg text-sm ${
                    keyValid
                      ? 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-500/20'
                      : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20'
                  }`}
                >
                  {keyValid ? 'API key verified!' : `Invalid key: ${keyError}`}
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={prev}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleTestKey}
                  disabled={!apiKey.trim() || testing}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40"
                >
                  {testing ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Testing...
                    </>
                  ) : (
                    'Test Key'
                  )}
                </button>
                <button
                  onClick={() => {
                    if (apiKey.trim()) {
                      window.api.setApiKey(apiKey.trim())
                    }
                    next()
                  }}
                  disabled={!apiKey.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-colors disabled:opacity-40"
                >
                  Continue
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Knowledge store */}
          {step === 'knowledge' && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center">
                  <Database size={20} className="text-purple-500" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                    Knowledge Store
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Your personal knowledge engine
                  </p>
                </div>
              </div>

              <div className="px-4 py-4 rounded-xl bg-purple-50 dark:bg-purple-500/5 border border-purple-100 dark:border-purple-500/10">
                <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  DeepNote indexes your documents, notes, and conversations into a private
                  knowledge base with semantic search. Everything stays on your Mac.
                </p>
              </div>

              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                {knowledgeReady ? (
                  <>
                    <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-sm text-zinc-600 dark:text-zinc-300">
                      Knowledge store ready{memoryCount > 0 ? ` — ${memoryCount.toLocaleString()} memories` : ''}
                    </span>
                  </>
                ) : (
                  <>
                    <Loader2 size={16} className="text-purple-500 animate-spin" />
                    <span className="text-sm text-zinc-600 dark:text-zinc-300">
                      Initializing knowledge store...
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={prev}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                >
                  Back
                </button>
                <div className="flex-1" />
                <button
                  onClick={next}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-colors"
                >
                  Continue
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Permissions */}
          {step === 'permissions' && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-500/10 flex items-center justify-center">
                  <Shield size={20} className="text-green-500" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                    Permissions
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Optional &mdash; enables deeper indexing
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {[
                  {
                    id: 'fullDisk' as const,
                    label: 'Full Disk Access',
                    desc: 'Index Documents, Desktop, Downloads',
                    recommended: true,
                  },
                  {
                    id: 'accessibility' as const,
                    label: 'Accessibility',
                    desc: 'Track active app for context (optional)',
                    recommended: false,
                  },
                  {
                    id: 'mail' as const,
                    label: 'Mail Access',
                    desc: 'Index Apple Mail messages (optional)',
                    recommended: false,
                  },
                ].map((perm) => (
                  <div
                    key={perm.id}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800"
                  >
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center ${
                        permissions[perm.id]
                          ? 'bg-green-500 text-white'
                          : 'border-2 border-zinc-300 dark:border-zinc-600'
                      }`}
                    >
                      {permissions[perm.id] && <Check size={12} />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                        {perm.label}
                        {perm.recommended && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-500/10 text-blue-500 border border-blue-200 dark:border-blue-500/20">
                            Recommended
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-zinc-400 dark:text-zinc-500">{perm.desc}</p>
                    </div>
                    <button
                      onClick={() => {
                        // Open System Settings to the appropriate pane
                        const urls: Record<string, string> = {
                          fullDisk:
                            'x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles',
                          accessibility:
                            'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
                          mail: 'x-apple.systempreferences:com.apple.preference.security?Privacy_MailClient',
                        }
                        window.open(urls[perm.id], '_blank')
                      }}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-500/20 transition-colors"
                    >
                      Open Settings
                    </button>
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-relaxed">
                You can grant these later in Settings. DeepNote works without them but with
                reduced indexing.
              </p>

              <div className="flex items-center gap-3">
                <button
                  onClick={prev}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                >
                  Back
                </button>
                <div className="flex-1" />
                <button
                  onClick={next}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-colors"
                >
                  Continue
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Ready */}
          {step === 'ready' && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center">
                <Zap size={32} className="text-white" />
              </div>

              <div>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  You&apos;re all set!
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed max-w-sm mx-auto">
                  DeepNote AI is ready. Your knowledge engine is running in the background.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-left">
                <div className="px-3 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200 flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-[10px] font-mono">
                      &#8984;&#8679;Space
                    </kbd>
                  </p>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">
                    Quick memory search from anywhere
                  </p>
                </div>
                <div className="px-3 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200 flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-[10px] font-mono">
                      &#8984;&#8679;N
                    </kbd>
                  </p>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">
                    Capture clipboard to a notebook
                  </p>
                </div>
              </div>

              <button
                onClick={handleFinish}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-medium transition-colors"
              >
                Start Using DeepNote
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
