import { Hash } from 'lucide-react'

interface TagCount {
  tag: string
  count: number
}

interface TagBrowserProps {
  tags: TagCount[]
  selectedTag: string | null
  onSelectTag: (tag: string | null) => void
}

export function TagBrowser({ tags, selectedTag, onSelectTag }: TagBrowserProps) {
  if (tags.length === 0) return null

  return (
    <div className="flex items-center gap-1.5 px-6 py-2 border-b border-black/[0.06] dark:border-white/[0.06] overflow-x-auto bg-black/[0.01] dark:bg-white/[0.01]">
      <Hash size={12} className="text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
      {selectedTag && (
        <button
          onClick={() => onSelectTag(null)}
          className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-black/[0.04] dark:bg-white/[0.04] text-zinc-500 dark:text-zinc-400 hover:bg-black/[0.08] dark:hover:bg-white/[0.08] transition-colors flex-shrink-0"
        >
          All
        </button>
      )}
      {tags.map(({ tag, count }) => (
        <button
          key={tag}
          onClick={() => onSelectTag(selectedTag === tag ? null : tag)}
          className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors flex-shrink-0 ${
            selectedTag === tag
              ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300'
              : 'bg-black/[0.04] dark:bg-white/[0.04] text-zinc-500 dark:text-zinc-400 hover:bg-black/[0.08] dark:hover:bg-white/[0.08]'
          }`}
        >
          {tag} <span className="opacity-60">({count})</span>
        </button>
      ))}
    </div>
  )
}
