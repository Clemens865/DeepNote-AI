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
    <div className="px-6 py-5">
      <div className="max-w-3xl mx-auto w-full">
        {/* Upload indicator chip */}
        {uploadingFile && (
          <div className="flex items-center gap-1.5 mb-2 px-3 py-1.5 bg-indigo-50/50 dark:bg-indigo-500/[0.06] rounded-full w-fit border border-indigo-200/50 dark:border-indigo-500/10">
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
            className="flex-shrink-0 w-9 h-9 mb-[6px] rounded-xl flex items-center justify-center text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
              className="w-full pl-5 pr-14 py-3.5 bg-white/80 dark:bg-black/60 backdrop-blur-2xl border border-black/[0.1] dark:border-white/[0.1] rounded-2xl focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 resize-none h-[52px] text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 disabled:opacity-50 shadow-[0_4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)] transition-all"
            />
            <button
              onClick={handleSend}
              disabled={!message.trim() || disabled || !hasSources}
              className="absolute right-2.5 bottom-2.5 w-9 h-9 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:text-white dark:disabled:text-zinc-500 flex items-center justify-center shadow-md hover:scale-105 active:scale-95"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
