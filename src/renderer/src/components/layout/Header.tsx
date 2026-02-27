import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useNotebookStore } from '../../stores/notebookStore'
import { useAppStore } from '../../stores/appStore'
import { SettingsModal } from '../common/SettingsModal'
import { GlobalSearchDialog } from '../search/GlobalSearchDialog'
import { ManualDialog } from '../help/ManualDialog'
import { CommandPalette } from '../common/CommandPalette'
import { QuickSwitcher } from '../common/QuickSwitcher'
import { ArrowLeft, Download, Settings, Sun, Moon, Search, BookOpen } from 'lucide-react'

export function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const currentNotebook = useNotebookStore((s) => s.currentNotebook)
  const activeView = useAppStore((s) => s.activeView)
  const { darkMode, toggleDarkMode } = useAppStore()
  const isWorkspace = location.pathname.startsWith('/notebook/')
  const [showSettings, setShowSettings] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchInitialFilter, setSearchInitialFilter] = useState<'all' | 'notebooks' | 'files' | 'memories' | 'emails'>('all')
  const [showManual, setShowManual] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [showQuickSwitcher, setShowQuickSwitcher] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)

  // Cmd+K for search, Cmd+Shift+F for files, Cmd+P for command palette, Cmd+O for quick switcher
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchInitialFilter('all')
        setShowSearch(true)
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault()
        setSearchInitialFilter('files')
        setShowSearch(true)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault()
        setShowCommandPalette(true)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
        e.preventDefault()
        setShowQuickSwitcher(true)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (!showExport) return
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExport(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showExport])

  const handleExport = async (format: 'json' | 'html') => {
    if (!currentNotebook) return
    setShowExport(false)
    try {
      await window.api.exportNotebook({ notebookId: currentNotebook.id, format })
    } catch (err) {
      console.error('Export failed:', err)
    }
  }

  const viewTitle = activeView === 'chat' ? 'Notebook Chat' : 'Notes'

  return (
    <header className="titlebar-drag flex items-center h-12 px-5 bg-white/80 dark:bg-black/40 backdrop-blur-xl border-b border-black/[0.06] dark:border-white/[0.06] shrink-0">
      <div className="w-[70px] shrink-0" />

      {isWorkspace && (
        <button
          onClick={() => navigate('/')}
          className="titlebar-no-drag mr-4 flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Home
        </button>
      )}

      <div className="flex items-center gap-2 titlebar-no-drag">
        {isWorkspace && currentNotebook ? (
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
            {viewTitle}
          </span>
        ) : (
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">DeepNote AI</span>
        )}
      </div>

      <div className="flex-1" />

      {isWorkspace && currentNotebook && (
        <div className="relative" ref={exportRef}>
          <button
            onClick={() => setShowExport(!showExport)}
            className="titlebar-no-drag w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-colors mr-1"
            title="Export notebook"
          >
            <Download className="w-4 h-4" />
          </button>
          {showExport && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-black/[0.08] dark:border-white/[0.08] rounded-xl shadow-xl z-50 py-1">
              <button
                onClick={() => handleExport('json')}
                className="w-full text-left px-3 py-2 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
              >
                Export as JSON
              </button>
              <button
                onClick={() => handleExport('html')}
                className="w-full text-left px-3 py-2 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
              >
                Export as HTML
              </button>
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => { setSearchInitialFilter('all'); setShowSearch(true) }}
        className="titlebar-no-drag w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-colors mr-1"
        title="Search all notebooks (Cmd+K)"
      >
        <Search className="w-4 h-4" />
      </button>

      <button
        onClick={() => setShowManual(true)}
        className="titlebar-no-drag w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-colors mr-1"
        title="User Manual"
      >
        <BookOpen className="w-4 h-4" />
      </button>

      <button
        onClick={toggleDarkMode}
        className="titlebar-no-drag w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-colors mr-1"
        title={darkMode ? 'Light mode' : 'Dark mode'}
      >
        {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      <button
        onClick={() => setShowSettings(true)}
        className="titlebar-no-drag w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-colors"
        title="Settings"
      >
        <Settings className="w-4 h-4" />
      </button>

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <GlobalSearchDialog
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        initialFilter={searchInitialFilter}
        onNavigate={(notebookId) => {
          setShowSearch(false)
          navigate(`/notebook/${notebookId}`)
        }}
      />
      <ManualDialog isOpen={showManual} onClose={() => setShowManual(false)} />
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onOpenSearch={() => { setSearchInitialFilter('all'); setShowSearch(true) }}
        onOpenSettings={() => setShowSettings(true)}
      />
      <QuickSwitcher isOpen={showQuickSwitcher} onClose={() => setShowQuickSwitcher(false)} />
    </header>
  )
}
