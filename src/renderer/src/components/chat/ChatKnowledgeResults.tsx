import { Database } from 'lucide-react'
import type { KnowledgeSearchResult } from '@shared/types'

interface ChatKnowledgeResultsProps {
  results: KnowledgeSearchResult[]
}

export function ChatKnowledgeResults({ results }: ChatKnowledgeResultsProps) {
  if (!results.length) return null

  return (
    <div className="mt-3 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
      <div className="flex flex-wrap gap-1.5">
        {results.map((r, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 text-[10px] font-medium bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20 rounded-full px-2 py-0.5"
            title={r.content}
          >
            <Database size={10} />
            {r.type}
            <span className="opacity-60">{Math.round(r.similarity * 100)}%</span>
          </span>
        ))}
      </div>
    </div>
  )
}
