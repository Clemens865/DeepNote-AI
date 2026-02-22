import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useNotebookStore } from '../../stores/notebookStore'
import { useAppStore } from '../../stores/appStore'
import { SettingsModal } from '../common/SettingsModal'
import { GlobalSearchDialog } from '../search/GlobalSearchDialog'
import { ManualDialog } from '../help/ManualDialog'
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
  const exportRef = useRef<HTMLDivElement>(null)

  // Cmd+K keyboard shortcut for global search, Cmd+Shift+F for files filter
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
    <header className="titlebar-drag flex items-center h-12 px-5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm shrink-0">
      <div className="w-[70px] shrink-0" />

      {isWorkspace && (
        <button
          onClick={() => navigate('/')}
          className="titlebar-no-drag mr-4 flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Home
        </button>
      )}

      <div className="flex items-center gap-2 titlebar-no-drag">
        {isWorkspace && currentNotebook ? (
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 tracking-tight">
            {viewTitle}
          </span>
        ) : (
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">DeepNote AI</span>
        )}
      </div>

      <div className="flex-1" />

      {isWorkspace && currentNotebook && (
        <div className="relative" ref={exportRef}>
          <button
            onClick={() => setShowExport(!showExport)}
            className="titlebar-no-drag w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors mr-1"
            title="Export notebook"
          >
            <Download className="w-4 h-4" />
          </button>
          {showExport && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 py-1">
              <button
                onClick={() => handleExport('json')}
                className="w-full text-left px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Export as JSON
              </button>
              <button
                onClick={() => handleExport('html')}
                className="w-full text-left px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Export as HTML
              </button>
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => { setSearchInitialFilter('all'); setShowSearch(true) }}
        className="titlebar-no-drag w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors mr-1"
        title="Search all notebooks (Cmd+K)"
      >
        <Search className="w-4 h-4" />
      </button>

      <button
        onClick={() => setShowManual(true)}
        className="titlebar-no-drag w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors mr-1"
        title="User Manual"
      >
        <BookOpen className="w-4 h-4" />
      </button>

      <button
        onClick={toggleDarkMode}
        className="titlebar-no-drag w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors mr-1"
        title={darkMode ? 'Light mode' : 'Dark mode'}
      >
        {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      <button
        onClick={() => setShowSettings(true)}
        className="titlebar-no-drag w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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
    </header>
  )
}
