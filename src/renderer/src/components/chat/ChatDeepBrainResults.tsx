import { Brain, FileText, Mail } from 'lucide-react'
import type { DeepBrainResults } from '@shared/types'

interface ChatDeepBrainResultsProps {
  results: DeepBrainResults
}

export function ChatDeepBrainResults({ results }: ChatDeepBrainResultsProps) {
  const { memories, files, emails } = results
  if (!memories.length && !files.length && !emails.length) return null

  const handleOpenFile = (filePath: string) => {
    window.api.systemOpenFile({ filePath })
  }

  return (
    <div className="mt-3 pt-3 border-t border-black/[0.06] dark:border-white/[0.06] space-y-2">
      {/* Memories */}
      {memories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {memories.map((m, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 text-[10px] font-medium bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20 rounded-full px-2 py-0.5"
              title={m.content}
            >
              <Brain size={10} />
              {m.memoryType}
              <span className="opacity-60">{Math.round(m.similarity * 100)}%</span>
            </span>
          ))}
        </div>
      )}

      {/* Files */}
      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((f, i) => (
            <button
              key={i}
              onClick={() => handleOpenFile(f.path)}
              className="w-full text-left group flex items-start gap-2 p-2 rounded-lg bg-purple-50/50 dark:bg-purple-500/5 border border-purple-100 dark:border-purple-500/15 hover:border-purple-300 dark:hover:border-purple-500/30 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors cursor-pointer"
            >
              <FileText size={14} className="mt-0.5 text-purple-400 dark:text-purple-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">
                    {f.name}
                  </span>
                  <span className="text-[9px] text-purple-500 dark:text-purple-400 font-medium shrink-0">
                    {Math.round(f.similarity * 100)}%
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono truncate">
                  {f.path}
                </p>
                {f.chunk && (
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2">
                    {f.chunk}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Emails */}
      {emails.length > 0 && (
        <div className="space-y-1.5">
          {emails.map((e, i) => (
            <div
              key={i}
              className="flex items-start gap-2 p-2 rounded-lg bg-purple-50/50 dark:bg-purple-500/5 border border-purple-100 dark:border-purple-500/15"
            >
              <Mail size={14} className="mt-0.5 text-purple-400 dark:text-purple-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">
                    {e.subject}
                  </span>
                  <span className="text-[9px] text-purple-500 dark:text-purple-400 font-medium shrink-0">
                    {Math.round(e.similarity * 100)}%
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                  {e.sender}{e.date ? ` · ${e.date}` : ''}
                </p>
                {e.chunk && (
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2">
                    {e.chunk}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
