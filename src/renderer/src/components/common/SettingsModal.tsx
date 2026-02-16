import { useState, useEffect } from 'react'
import { Settings, Info } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'
import { Spinner } from './Spinner'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

type Tab = 'settings' | 'about'

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

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [tab, setTab] = useState<Tab>('settings')
  const [apiKey, setApiKey] = useState('')
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)

  useEffect(() => {
    if (isOpen) {
      window.api.getApiKey().then((key: string) => {
        setApiKey(key || '')
        setSaved(false)
        setTestResult(null)
      })
    }
  }, [isOpen])

  const handleSave = async () => {
    await window.api.setApiKey(apiKey)
    setSaved(true)
    setTestResult(null)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await window.api.testApiKey(apiKey) as { success: boolean; error?: string }
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
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                Gemini API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value)
                  setSaved(false)
                  setTestResult(null)
                }}
                placeholder="Enter your Gemini API key..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 dark:focus:border-indigo-500/50"
              />
              <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                Get your API key from{' '}
                <span className="text-indigo-600 dark:text-indigo-400">aistudio.google.com</span>
              </p>
            </div>

            {testResult && (
              <div
                className={`px-3 py-2 rounded-lg text-sm ${
                  testResult.success
                    ? 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-500/20'
                    : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20'
                }`}
              >
                {testResult.success
                  ? 'API key is valid!'
                  : `Invalid API key: ${testResult.error || 'Unknown error'}`}
              </div>
            )}

            {saved && (
              <div className="px-3 py-2 rounded-lg text-sm bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-500/20">
                API key saved!
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <Button variant="secondary" onClick={handleTest} disabled={!apiKey.trim() || testing}>
                {testing ? (
                  <span className="flex items-center gap-2">
                    <Spinner size="sm" /> Testing...
                  </span>
                ) : (
                  'Test Key'
                )}
              </Button>
              <Button onClick={handleSave} disabled={!apiKey.trim()}>
                Save
              </Button>
              <div className="flex-1" />
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
