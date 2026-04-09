import { useState, useEffect, useMemo, useCallback } from 'react'
import { List, ChevronRight, ChevronDown } from 'lucide-react'

interface HeadingItem {
  level: number
  text: string
  index: number
}

interface OutlinePanelProps {
  content: string
  onScrollToHeading: (level: number, index: number) => void
}

/** Parse HTML content to extract h1/h2/h3 headings */
function parseHeadings(html: string): HeadingItem[] {
  const headings: HeadingItem[] = []
  const regex = /<h([1-3])[^>]*>(.*?)<\/h[1-3]>/gi
  let match: RegExpExecArray | null
  let index = 0

  while ((match = regex.exec(html)) !== null) {
    const level = parseInt(match[1], 10)
    // Strip inner HTML tags to get plain text
    const text = match[2].replace(/<[^>]*>/g, '').trim()
    if (text) {
      headings.push({ level, text, index: index++ })
    }
  }

  return headings
}

interface OutlineNodeProps {
  heading: HeadingItem
  children: HeadingItem[]
  allHeadings: HeadingItem[]
  activeIndex: number | null
  collapsed: Set<number>
  onToggle: (index: number) => void
  onScrollToHeading: (level: number, index: number) => void
}

function OutlineNode({
  heading,
  children,
  allHeadings,
  activeIndex,
  collapsed,
  onToggle,
  onScrollToHeading,
}: OutlineNodeProps) {
  const isCollapsed = collapsed.has(heading.index)
  const hasChildren = children.length > 0
  const isActive = activeIndex === heading.index

  return (
    <div>
      <button
        onClick={() => onScrollToHeading(heading.level, heading.index)}
        className={`w-full flex items-center gap-1 px-2 py-1.5 rounded-md text-left transition-colors group ${
          isActive
            ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300'
            : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.04] text-zinc-600 dark:text-zinc-400'
        }`}
        style={{ paddingLeft: `${(heading.level - 1) * 12 + 8}px` }}
      >
        {hasChildren ? (
          <span
            onClick={(e) => {
              e.stopPropagation()
              onToggle(heading.index)
            }}
            className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded hover:bg-black/[0.06] dark:hover:bg-white/[0.06]"
          >
            {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          </span>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}
        <span
          className={`truncate ${
            heading.level === 1
              ? 'text-xs font-semibold'
              : heading.level === 2
                ? 'text-[11px] font-medium'
                : 'text-[11px]'
          }`}
        >
          {heading.text}
        </span>
      </button>
      {hasChildren && !isCollapsed && (
        <div>
          {children.map((child) => {
            const grandchildren = getDirectChildren(child, allHeadings)
            return (
              <OutlineNode
                key={child.index}
                heading={child}
                children={grandchildren}
                allHeadings={allHeadings}
                activeIndex={activeIndex}
                collapsed={collapsed}
                onToggle={onToggle}
                onScrollToHeading={onScrollToHeading}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Get direct children of a heading (next level headings until same-or-higher level) */
function getDirectChildren(parent: HeadingItem, allHeadings: HeadingItem[]): HeadingItem[] {
  const children: HeadingItem[] = []
  const parentIdx = allHeadings.indexOf(parent)

  for (let i = parentIdx + 1; i < allHeadings.length; i++) {
    const h = allHeadings[i]
    if (h.level <= parent.level) break
    if (h.level === parent.level + 1) {
      children.push(h)
    }
  }

  return children
}

export function OutlinePanel({ content, onScrollToHeading }: OutlinePanelProps) {
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const headings = useMemo(() => parseHeadings(content), [content])

  // Find top-level headings (the minimum level present)
  const topLevel = useMemo(() => {
    if (headings.length === 0) return 1
    return Math.min(...headings.map((h) => h.level))
  }, [headings])

  const topLevelHeadings = useMemo(
    () => headings.filter((h) => h.level === topLevel),
    [headings, topLevel]
  )

  // Reset collapsed state when content changes significantly
  useEffect(() => {
    setCollapsed(new Set())
    setActiveIndex(null)
  }, [content])

  const handleToggle = useCallback((index: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }, [])

  const handleScrollTo = useCallback(
    (level: number, index: number) => {
      setActiveIndex(index)
      onScrollToHeading(level, index)
    },
    [onScrollToHeading]
  )

  if (headings.length === 0) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-1.5 mb-3">
          <List size={14} className="text-zinc-400 dark:text-zinc-500" />
          <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">
            Outline
          </span>
        </div>
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-relaxed">
          No headings found. Use headings to create an outline.
        </p>
      </div>
    )
  }

  return (
    <div className="p-3">
      <div className="flex items-center gap-1.5 mb-2 px-1">
        <List size={14} className="text-zinc-400 dark:text-zinc-500" />
        <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">
          Outline
        </span>
        <span className="text-[10px] text-zinc-400/60 dark:text-zinc-500/60 ml-auto">
          {headings.length}
        </span>
      </div>
      <div className="space-y-0.5">
        {topLevelHeadings.map((heading) => {
          const children = getDirectChildren(heading, headings)
          return (
            <OutlineNode
              key={heading.index}
              heading={heading}
              children={children}
              allHeadings={headings}
              activeIndex={activeIndex}
              collapsed={collapsed}
              onToggle={handleToggle}
              onScrollToHeading={handleScrollTo}
            />
          )
        })}
      </div>
    </div>
  )
}
