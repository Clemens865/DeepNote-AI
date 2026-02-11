import { useState, useEffect } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'
import { Spinner } from './Spinner'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
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
    <Modal isOpen={isOpen} onClose={onClose} title="Settings">
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
    </Modal>
  )
}
