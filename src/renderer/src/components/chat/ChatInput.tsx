import { useState } from 'react'
import { useNotebookStore } from '../../stores/notebookStore'
import { Send, Paperclip, Loader2 } from 'lucide-react'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
  onUpload?: () => void
  uploadingFile?: string | null
}

export function ChatInput({ onSend, disabled, onUpload, uploadingFile }: ChatInputProps) {
  const [message, setMessage] = useState('')
  const sources = useNotebookStore((s) => s.sources)
  const hasSources = sources.length > 0

  const handleSend = () => {
    if (!message.trim() || disabled) return
    onSend(message.trim())
    setMessage('')
  }

  return (
    <div className="px-6 py-5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
      <div className="max-w-3xl mx-auto w-full">
        {/* Upload indicator chip */}
        {uploadingFile && (
          <div className="flex items-center gap-1.5 mb-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg w-fit">
            <Loader2 size={12} className="animate-spin text-indigo-500" />
            <span className="text-xs text-indigo-600 dark:text-indigo-400">Adding {uploadingFile}...</span>
          </div>
        )}

        <div className="relative flex items-end gap-2">
          {/* Paperclip upload button */}
          <button
            onClick={onUpload}
            disabled={!!uploadingFile}
            title="Upload a file as source"
            className="flex-shrink-0 w-9 h-9 mb-[6px] rounded-xl flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Paperclip size={18} />
          </button>

          <div className="relative flex-1">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder={hasSources ? 'Ask a question about your sources...' : 'Add sources or upload a file to start...'}
              disabled={(!hasSources && !onUpload) || disabled}
              rows={1}
              className="w-full pl-5 pr-14 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 dark:focus:border-indigo-500/50 resize-none h-[52px] text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!message.trim() || disabled || !hasSources}
              className="absolute right-2.5 bottom-2.5 w-9 h-9 bg-indigo-600 dark:bg-indigo-500 text-white rounded-xl hover:bg-indigo-700 dark:hover:bg-indigo-400 transition-all disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-white dark:disabled:text-slate-500 flex items-center justify-center shadow-sm"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
