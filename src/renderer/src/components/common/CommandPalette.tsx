import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../stores/appStore'
import { useNotebookStore } from '../../stores/notebookStore'
import {
  Command, Home, MessageSquare, StickyNote, FileCode, Settings, Sun, Moon,
  Search, Headphones, BrainCircuit, Presentation, Layers, HelpCircle,
  Table2, ImageIcon, LayoutDashboard, BookOpen, Trophy, GitCompare, Network,
  FileText, Globe, FileBarChart, PanelRightOpen, PanelRightClose, PanelLeftOpen, PanelLeftClose,
} from 'lucide-react'
import type { Notebook } from '@shared/types'

interface CommandItem {
  id: string
  label: string
  description?: string
  category: 'navigation' | 'view' | 'studio' | 'settings' | 'action'
  icon: React.ReactNode
  action: () => void
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onOpenSearch: () => void
  onOpenSettings: () => void
}

const CATEGORY_ORDER: CommandItem['category'][] = ['navigation', 'view', 'action', 'studio', 'settings']
const CATEGORY_LABELS: Record<string, string> = {
  navigation: 'Navigation',
  view: 'Views',
  action: 'Actions',
  studio: 'Studio Tools',
  settings: 'Settings',
}

export function CommandPalette({ isOpen, onClose, onOpenSearch, onOpenSettings }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const navigate = useNavigate()
  const { activeView, setActiveView, darkMode, toggleDarkMode, toggleStudio, toggleSources, studioCollapsed, sourcesCollapsed } = useAppStore()
  const currentNotebook = useNotebookStore((s) => s.currentNotebook)

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      window.api.listNotebooks().then((nbs: Notebook[]) => setNotebooks(nbs))
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  const commands = useMemo<CommandItem[]>(() => {
    const cmds: CommandItem[] = [
      // Navigation
      { id: 'go-home', label: 'Go to Home', category: 'navigation', icon: <Home size={16} />, action: () => { navigate('/'); onClose() } },
      ...notebooks.map((nb) => ({
        id: `go-notebook-${nb.id}`,
        label: `Go to ${nb.title}`,
        description: `${nb.emoji} Notebook`,
        category: 'navigation' as const,
        icon: <span className="text-base">{nb.emoji}</span>,
        action: () => { navigate(`/notebook/${nb.id}`); onClose() },
      })),

      // Views
      { id: 'view-chat', label: 'Switch to Chat', category: 'view', icon: <MessageSquare size={16} />, action: () => { setActiveView('chat'); onClose() } },
      { id: 'view-notes', label: 'Switch to Notes', category: 'view', icon: <StickyNote size={16} />, action: () => { setActiveView('notes'); onClose() } },
      { id: 'view-editor', label: 'Switch to Editor', category: 'view', icon: <FileCode size={16} />, action: () => { setActiveView('editor'); onClose() } },
      {
        id: 'toggle-studio', label: studioCollapsed ? 'Show Studio Panel' : 'Hide Studio Panel', category: 'view',
        icon: studioCollapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />,
        action: () => { toggleStudio(); onClose() },
      },
      {
        id: 'toggle-sources', label: sourcesCollapsed ? 'Show Sources Panel' : 'Hide Sources Panel', category: 'view',
        icon: sourcesCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />,
        action: () => { toggleSources(); onClose() },
      },

      // Actions
      { id: 'open-search', label: 'Open Search', description: 'Cmd+K', category: 'action', icon: <Search size={16} />, action: () => { onClose(); onOpenSearch() } },

      // Studio tools
      { id: 'studio-audio', label: 'Generate Audio Overview', category: 'studio', icon: <Headphones size={16} />, action: () => { setActiveView('chat'); onClose() } },
      { id: 'studio-slides', label: 'Generate Slide Deck', category: 'studio', icon: <Presentation size={16} />, action: () => { onClose() } },
      { id: 'studio-mindmap', label: 'Generate Mind Map', category: 'studio', icon: <BrainCircuit size={16} />, action: () => { onClose() } },
      { id: 'studio-flashcard', label: 'Generate Flashcards', category: 'studio', icon: <Layers size={16} />, action: () => { onClose() } },
      { id: 'studio-quiz', label: 'Generate Quiz', category: 'studio', icon: <HelpCircle size={16} />, action: () => { onClose() } },
      { id: 'studio-report', label: 'Generate Report', category: 'studio', icon: <FileBarChart size={16} />, action: () => { onClose() } },
      { id: 'studio-datatable', label: 'Generate Data Table', category: 'studio', icon: <Table2 size={16} />, action: () => { onClose() } },
      { id: 'studio-infographic', label: 'Generate Infographic', category: 'studio', icon: <ImageIcon size={16} />, action: () => { onClose() } },
      { id: 'studio-dashboard', label: 'Generate Dashboard', category: 'studio', icon: <LayoutDashboard size={16} />, action: () => { onClose() } },
      { id: 'studio-lit-review', label: 'Generate Literature Review', category: 'studio', icon: <BookOpen size={16} />, action: () => { onClose() } },
      { id: 'studio-comp-analysis', label: 'Generate Competitive Analysis', category: 'studio', icon: <Trophy size={16} />, action: () => { onClose() } },
      { id: 'studio-diff', label: 'Generate Document Diff', category: 'studio', icon: <GitCompare size={16} />, action: () => { onClose() } },
      { id: 'studio-citation', label: 'Generate Citation Graph', category: 'studio', icon: <Network size={16} />, action: () => { onClose() } },
      { id: 'studio-whitepaper', label: 'Generate White Paper', category: 'studio', icon: <FileText size={16} />, action: () => { onClose() } },
      { id: 'studio-html-pres', label: 'Generate Web Presentation', category: 'studio', icon: <Globe size={16} />, action: () => { onClose() } },

      // Settings
      { id: 'open-settings', label: 'Open Settings', category: 'settings', icon: <Settings size={16} />, action: () => { onClose(); onOpenSettings() } },
      { id: 'toggle-dark', label: darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode', category: 'settings', icon: darkMode ? <Sun size={16} /> : <Moon size={16} />, action: () => { toggleDarkMode(); onClose() } },
    ]
    return cmds
  }, [notebooks, activeView, darkMode, studioCollapsed, sourcesCollapsed, currentNotebook, navigate, onClose, onOpenSearch, onOpenSettings, setActiveView, toggleDarkMode, toggleStudio, toggleSources])

  const filtered = useMemo(() => {
    if (!query.trim()) return commands
    const q = query.toLowerCase()
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || (c.description && c.description.toLowerCase().includes(q))
    )
  }, [commands, query])

  // Group by category
  const grouped = useMemo(() => {
    const groups: { category: string; items: CommandItem[] }[] = []
    for (const cat of CATEGORY_ORDER) {
      const items = filtered.filter((c) => c.category === cat)
      if (items.length > 0) groups.push({ category: cat, items })
    }
    return groups
  }, [filtered])

  const flatItems = useMemo(() => grouped.flatMap((g) => g.items), [grouped])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, flatItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      flatItems[selectedIndex]?.action()
    }
  }

  if (!isOpen) return null

  let flatIdx = 0

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-black/[0.08] dark:border-white/[0.08] overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
          <Command size={18} className="text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            className="flex-1 bg-transparent text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none"
          />
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-1">
          {flatItems.length === 0 && (
            <div className="px-5 py-6 text-center text-sm text-zinc-400 dark:text-zinc-500">
              No commands found
            </div>
          )}
          {grouped.map((group) => (
            <div key={group.category}>
              <div className="px-5 py-1.5">
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">
                  {CATEGORY_LABELS[group.category]}
                </span>
              </div>
              {group.items.map((item) => {
                const idx = flatIdx++
                return (
                  <button
                    key={item.id}
                    data-index={idx}
                    onClick={item.action}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full text-left px-5 py-2.5 flex items-center gap-3 transition-colors ${
                      selectedIndex === idx
                        ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
                    }`}
                  >
                    <span className={`flex-shrink-0 ${selectedIndex === idx ? 'text-indigo-500' : 'text-zinc-400 dark:text-zinc-500'}`}>
                      {item.icon}
                    </span>
                    <span className="text-sm">{item.label}</span>
                    {item.description && (
                      <span className="ml-auto text-[10px] text-zinc-400 dark:text-zinc-500">{item.description}</span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-2 border-t border-black/[0.06] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02] flex items-center gap-3">
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
            <kbd className="px-1 py-0.5 bg-black/[0.06] dark:bg-white/[0.06] rounded text-[9px] font-mono">&uarr;&darr;</kbd> navigate
            {' '}<kbd className="px-1 py-0.5 bg-black/[0.06] dark:bg-white/[0.06] rounded text-[9px] font-mono">Enter</kbd> select
            {' '}<kbd className="px-1 py-0.5 bg-black/[0.06] dark:bg-white/[0.06] rounded text-[9px] font-mono">Esc</kbd> close
          </p>
        </div>
      </div>
    </div>
  )
}
