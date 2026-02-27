import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import type { Notebook } from '@shared/types'

interface QuickSwitcherProps {
  isOpen: boolean
  onClose: () => void
}

export function QuickSwitcher({ isOpen, onClose }: QuickSwitcherProps) {
  const [query, setQuery] = useState('')
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      window.api.listNotebooks().then((nbs: Notebook[]) => setNotebooks(nbs))
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  const filtered = useMemo(() => {
    if (!query.trim()) return notebooks
    const q = query.toLowerCase()
    return notebooks.filter((nb) => nb.title.toLowerCase().includes(q))
  }, [notebooks, query])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const handleSelect = (nb: Notebook) => {
    onClose()
    navigate(`/notebook/${nb.id}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[selectedIndex]) handleSelect(filtered[selectedIndex])
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-black/[0.08] dark:border-white/[0.08] overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
          <span className="text-base">📓</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Switch to notebook..."
            className="flex-1 bg-transparent text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none"
          />
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[40vh] overflow-y-auto py-1">
          {filtered.length === 0 && (
            <div className="px-5 py-6 text-center text-sm text-zinc-400 dark:text-zinc-500">
              {notebooks.length === 0 ? 'No notebooks yet' : 'No matching notebooks'}
            </div>
          )}
          {filtered.map((nb, idx) => (
            <button
              key={nb.id}
              data-index={idx}
              onClick={() => handleSelect(nb)}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={`w-full text-left px-5 py-3 flex items-center gap-3 transition-colors ${
                selectedIndex === idx
                  ? 'bg-indigo-50 dark:bg-indigo-500/10'
                  : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
              }`}
            >
              <span className="text-lg flex-shrink-0">{nb.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${
                  selectedIndex === idx ? 'text-indigo-700 dark:text-indigo-300' : 'text-zinc-800 dark:text-zinc-200'
                }`}>
                  {nb.title}
                </p>
                {nb.sourceCount !== undefined && (
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                    {nb.sourceCount} source{nb.sourceCount === 1 ? '' : 's'}
                  </p>
                )}
              </div>
              {selectedIndex === idx && (
                <ArrowRight size={14} className="text-indigo-400 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-2 border-t border-black/[0.06] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02]">
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
            <kbd className="px-1 py-0.5 bg-black/[0.06] dark:bg-white/[0.06] rounded text-[9px] font-mono">&uarr;&darr;</kbd> navigate
            {' '}<kbd className="px-1 py-0.5 bg-black/[0.06] dark:bg-white/[0.06] rounded text-[9px] font-mono">Enter</kbd> open
            {' '}<kbd className="px-1 py-0.5 bg-black/[0.06] dark:bg-white/[0.06] rounded text-[9px] font-mono">Esc</kbd> close
          </p>
        </div>
      </div>
    </div>
  )
}
