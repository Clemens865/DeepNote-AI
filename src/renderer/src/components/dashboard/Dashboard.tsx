import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotebooks } from '../../hooks/useNotebooks'
import { NotebookCard } from './NotebookCard'
import { CardCustomizeModal } from './CardCustomizeModal'
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
  const [customizingNotebookId, setCustomizingNotebookId] = useState<string | null>(null)

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
    <div className="h-full overflow-auto p-10 bg-zinc-50 dark:bg-[#050505]">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-[0_0_24px_rgba(99,102,241,0.25)] border border-white/10">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white tracking-tight">Welcome to DeepNote AI</h1>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-0.5">
                Upload sources and start exploring with AI
              </p>
            </div>
          </div>
        </div>

        {notebooks.length > 0 && (
          <div className="mb-6">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notebooks..."
                className="w-full pl-9 pr-4 py-2.5 rounded-full bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.06] text-zinc-700 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500/50 focus:bg-black/[0.05] dark:focus:bg-white/[0.05] text-sm transition-all"
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
              className="group flex flex-col items-center justify-center h-48 rounded-2xl border-2 border-dashed border-black/[0.08] dark:border-white/[0.08] hover:border-indigo-400/50 dark:hover:border-indigo-400/30 bg-white/50 dark:bg-white/[0.02] hover:bg-indigo-50/50 dark:hover:bg-indigo-500/[0.03] transition-all"
            >
              <div className="w-12 h-12 rounded-full bg-black/[0.03] dark:bg-white/[0.03] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform border border-black/[0.05] dark:border-white/[0.05]">
                <Plus className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <span className="text-zinc-500 dark:text-zinc-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 text-sm font-medium">
                Create new notebook
              </span>
            </button>

            {filteredNotebooks.map((nb) => (
              <NotebookCard
                key={nb.id}
                notebook={nb}
                onClick={() => navigate(`/notebook/${nb.id}`)}
                onDelete={() => deleteNotebook(nb.id)}
                onCustomize={() => setCustomizingNotebookId(nb.id)}
              />
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create notebook">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-600 dark:text-zinc-300 mb-2">Choose an icon</label>
            <div className="flex flex-wrap gap-2">
              {ICON_OPTIONS.map(({ id, Icon }) => (
                <button
                  key={id}
                  onClick={() => setNewEmoji(id)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    newEmoji === id
                      ? 'bg-indigo-50 dark:bg-indigo-500/10 ring-2 ring-indigo-600 dark:ring-indigo-400 text-indigo-600 dark:text-indigo-400'
                      : 'bg-black/[0.03] dark:bg-white/[0.03] hover:bg-black/[0.06] dark:hover:bg-white/[0.06] text-zinc-500 dark:text-zinc-400 border border-black/[0.05] dark:border-white/[0.05]'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm text-zinc-600 dark:text-zinc-300 mb-2">Notebook title</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="My Research..."
              className="w-full px-4 py-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.06] text-zinc-700 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500/50 text-sm transition-all"
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
                  workspaceMode ? 'bg-indigo-600' : 'bg-zinc-200 dark:bg-zinc-700'
                }`}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    workspaceMode ? 'translate-x-5' : ''
                  }`}
                />
              </div>
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                <span className="text-sm text-zinc-600 dark:text-zinc-300">Link to local folder</span>
              </div>
            </label>
            {workspaceMode && (
              <div className="mt-3">
                <button
                  onClick={handlePickFolder}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-black/[0.03] dark:bg-white/[0.03] text-zinc-600 dark:text-zinc-300 border border-black/[0.06] dark:border-white/[0.06] rounded-xl hover:bg-black/[0.06] dark:hover:bg-white/[0.06] transition-colors text-sm"
                >
                  <FolderOpen className="w-4 h-4" />
                  {workspacePath ? 'Change folder' : 'Choose folder...'}
                </button>
                {workspacePath && (
                  <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500 truncate px-1" title={workspacePath}>
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

      {customizingNotebookId && (
        <CardCustomizeModal
          notebook={notebooks.find((nb) => nb.id === customizingNotebookId)!}
          isOpen={true}
          onClose={() => setCustomizingNotebookId(null)}
          onSave={() => {
            setCustomizingNotebookId(null)
            fetchNotebooks()
          }}
        />
      )}
    </div>
  )
}
