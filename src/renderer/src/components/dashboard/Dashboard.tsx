import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotebooks } from '../../hooks/useNotebooks'
import { NotebookCard } from './NotebookCard'
import { Modal } from '../common/Modal'
import { Button } from '../common/Button'
import { Spinner } from '../common/Spinner'
import {
  Plus, BookOpen, FlaskConical, Lightbulb, Target, Rocket,
  BarChart3, TestTubes, Palette, Notebook, GraduationCap, BrainCircuit,
  Search, Sparkles, FolderOpen,
} from 'lucide-react'

const ICON_OPTIONS = [
  { id: 'notebook', Icon: Notebook },
  { id: 'book-open', Icon: BookOpen },
  { id: 'flask', Icon: FlaskConical },
  { id: 'lightbulb', Icon: Lightbulb },
  { id: 'target', Icon: Target },
  { id: 'rocket', Icon: Rocket },
  { id: 'bar-chart', Icon: BarChart3 },
  { id: 'test-tubes', Icon: TestTubes },
  { id: 'palette', Icon: Palette },
  { id: 'graduation', Icon: GraduationCap },
  { id: 'brain', Icon: BrainCircuit },
]

export function Dashboard() {
  const { notebooks, loading, fetchNotebooks, createNotebook, deleteNotebook } = useNotebooks()
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newEmoji, setNewEmoji] = useState('notebook')
  const [workspaceMode, setWorkspaceMode] = useState(false)
  const [workspacePath, setWorkspacePath] = useState<string | null>(null)

  useEffect(() => {
    fetchNotebooks()
  }, [fetchNotebooks])

  const handleCreate = async () => {
    if (!newTitle.trim()) return
    if (workspaceMode && !workspacePath) return
    const notebook = await createNotebook(
      newTitle.trim(),
      newEmoji,
      workspaceMode ? workspacePath! : undefined
    )
    if (notebook) {
      setShowCreate(false)
      setNewTitle('')
      setNewEmoji('notebook')
      setWorkspaceMode(false)
      setWorkspacePath(null)
      navigate(`/notebook/${notebook.id}`)
    }
  }

  const handlePickFolder = async () => {
    const path = await window.api.openDirectoryDialog()
    if (path) {
      setWorkspacePath(path as string)
      if (!newTitle.trim()) {
        // Auto-fill title from folder name
        const folderName = (path as string).split('/').pop() || 'Workspace'
        setNewTitle(folderName)
      }
    }
  }

  const [searchQuery, setSearchQuery] = useState('')

  const filteredNotebooks = searchQuery.trim()
    ? notebooks.filter((nb) =>
        nb.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : notebooks

  return (
    <div className="h-full overflow-auto p-10 bg-slate-100 dark:bg-slate-950">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 dark:bg-indigo-500 p-2.5 rounded-xl text-white shadow-md shadow-indigo-200 dark:shadow-indigo-900/50">
              <Sparkles size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Welcome to DeepNote AI</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
                Upload sources and start exploring with AI
              </p>
            </div>
          </div>
        </div>

        {notebooks.length > 0 && (
          <div className="mb-6">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notebooks..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 dark:focus:border-indigo-500/50 text-sm"
              />
            </div>
          </div>
        )}

        {loading && notebooks.length === 0 ? (
          <div className="flex justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <button
              onClick={() => setShowCreate(true)}
              className="group flex flex-col items-center justify-center h-48 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500/50 bg-white dark:bg-slate-800/50 hover:bg-indigo-50 dark:hover:bg-indigo-500/5 transition-all"
            >
              <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Plus className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <span className="text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 text-sm font-medium">
                Create new notebook
              </span>
            </button>

            {filteredNotebooks.map((nb) => (
              <NotebookCard
                key={nb.id}
                notebook={nb}
                onClick={() => navigate(`/notebook/${nb.id}`)}
                onDelete={() => deleteNotebook(nb.id)}
              />
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create notebook">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-300 mb-2">Choose an icon</label>
            <div className="flex flex-wrap gap-2">
              {ICON_OPTIONS.map(({ id, Icon }) => (
                <button
                  key={id}
                  onClick={() => setNewEmoji(id)}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                    newEmoji === id
                      ? 'bg-indigo-50 dark:bg-indigo-500/10 ring-2 ring-indigo-600 dark:ring-indigo-400 text-indigo-600 dark:text-indigo-400'
                      : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-300 mb-2">Notebook title</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="My Research..."
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 dark:focus:border-indigo-500/50 text-sm"
              autoFocus
            />
          </div>
          {/* Workspace toggle */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => {
                  setWorkspaceMode(!workspaceMode)
                  if (workspaceMode) setWorkspacePath(null)
                }}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  workspaceMode ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    workspaceMode ? 'translate-x-5' : ''
                  }`}
                />
              </div>
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <span className="text-sm text-slate-600 dark:text-slate-300">Link to local folder</span>
              </div>
            </label>
            {workspaceMode && (
              <div className="mt-3">
                <button
                  onClick={handlePickFolder}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-sm"
                >
                  <FolderOpen className="w-4 h-4" />
                  {workspacePath ? 'Change folder' : 'Choose folder...'}
                </button>
                {workspacePath && (
                  <p className="mt-2 text-xs text-slate-400 dark:text-slate-500 truncate px-1" title={workspacePath}>
                    {workspacePath}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!newTitle.trim() || (workspaceMode && !workspacePath)}>
              Create
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
