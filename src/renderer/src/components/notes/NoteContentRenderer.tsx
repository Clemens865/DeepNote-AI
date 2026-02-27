interface NoteContentRendererProps {
  content: string
  onLinkClick: (noteTitle: string) => void
}

const LINK_REGEX = /\[\[([^\]]+)\]\]/g

export function NoteContentRenderer({ content, onLinkClick }: NoteContentRendererProps) {
  if (!content) return null

  // Check if content has any links
  if (!content.includes('[[')) {
    return null
  }

  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  const regex = new RegExp(LINK_REGEX)
  while ((match = regex.exec(content)) !== null) {
    // Text before the link
    if (match.index > lastIndex) {
      parts.push(
        <span key={`text-${lastIndex}`} className="text-zinc-500 dark:text-zinc-400">
          {content.slice(lastIndex, match.index)}
        </span>
      )
    }
    // The link itself
    const title = match[1]
    parts.push(
      <button
        key={`link-${match.index}`}
        onClick={() => onLinkClick(title)}
        className="text-indigo-600 dark:text-indigo-400 underline decoration-indigo-300 dark:decoration-indigo-600 underline-offset-2 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors cursor-pointer"
      >
        {title}
      </button>
    )
    lastIndex = match.index + match[0].length
  }

  // Remaining text
  if (lastIndex < content.length) {
    parts.push(
      <span key={`text-${lastIndex}`} className="text-zinc-500 dark:text-zinc-400">
        {content.slice(lastIndex)}
      </span>
    )
  }

  return (
    <div className="mt-3 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
      <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-2">
        Linked Notes
      </p>
      <div className="text-sm leading-relaxed whitespace-pre-wrap">
        {parts}
      </div>
    </div>
  )
}
