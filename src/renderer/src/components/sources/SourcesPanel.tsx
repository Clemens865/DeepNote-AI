import { useState } from 'react'
import { SourceList } from './SourceList'
import { AddSourceModal } from './AddSourceModal'
import { FileTreeView } from '../workspace/FileTreeView'
import { WorkspaceSyncBanner } from '../workspace/WorkspaceSyncBanner'
import { useNotebookStore } from '../../stores/notebookStore'
import { useAppStore } from '../../stores/appStore'
import { Plus, PanelLeftClose, PanelLeftOpen, MessageSquare, StickyNote, BookOpen, FileCode } from 'lucide-react'

interface SourcesPanelProps {
  collapsed: boolean
  onToggle: () => void
}

export function SourcesPanel({ collapsed, onToggle }: SourcesPanelProps) {
  const sources = useNotebookStore((s) => s.sources)
  const currentNotebook = useNotebookStore((s) => s.currentNotebook)
  const { activeView, setActiveView } = useAppStore()
  const [showAddModal, setShowAddModal] = useState(false)

  const isWorkspace = !!currentNotebook?.workspaceRootPath

  if (collapsed) {
    return (
      <div className="h-full flex flex-col items-center pt-4 bg-white/40 dark:bg-black/40 backdrop-blur-xl border-r border-black/[0.06] dark:border-white/[0.06]">
        <button
          onClick={onToggle}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-colors"
          title="Show sources"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-white/40 dark:bg-black/40 backdrop-blur-xl border-r border-black/[0.06] dark:border-white/[0.06]">
      <div className="p-5">
        {/* Notebook identity */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-[0_0_20px_rgba(99,102,241,0.2)] border border-white/10">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-semibold text-zinc-900 dark:text-zinc-100 text-[15px] leading-tight truncate">
                {currentNotebook?.title || 'DeepNote AI'}
              </h1>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                {sources.length} source{sources.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onToggle}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-colors"
            title="Collapse sources"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Add Source button (always available) */}
        <button
          onClick={() => setShowAddModal(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-full text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus size={18} />
          Add Source
        </button>
      </div>

      {/* Navigation */}
      <div className="px-5 mb-4">
        <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-2 px-1">
          Navigation
        </p>
        <div className="space-y-1">
          <button
            onClick={() => setActiveView('chat')}
            className={`flex items-center gap-3 px-3 py-2.5 w-full rounded-xl transition-all duration-200 text-sm ${
              activeView === 'chat'
                ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium'
                : 'text-zinc-500 dark:text-zinc-400 hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
            }`}
          >
            <MessageSquare size={18} />
            Notebook Chat
          </button>
          <button
            onClick={() => setActiveView('notes')}
            className={`flex items-center gap-3 px-3 py-2.5 w-full rounded-xl transition-all duration-200 text-sm ${
              activeView === 'notes'
                ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium'
                : 'text-zinc-500 dark:text-zinc-400 hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
            }`}
          >
            <StickyNote size={18} />
            Notes
          </button>
          {isWorkspace && (
            <button
              onClick={() => setActiveView('editor')}
              className={`flex items-center gap-3 px-3 py-2.5 w-full rounded-xl transition-all duration-200 text-sm ${
                activeView === 'editor'
                  ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium'
                  : 'text-zinc-500 dark:text-zinc-400 hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
              }`}
            >
              <FileCode size={18} />
              Editor
            </button>
          )}
        </div>
      </div>

      {/* Content area: workspace file tree or regular source list */}
      <div className="flex-1 overflow-auto px-5 pb-4">
        {isWorkspace && (
          <>
            <WorkspaceSyncBanner />
            <FileTreeView />
            {/* Also show external sources below the tree */}
            {sources.length > 0 && (
              <div className="mt-4 pt-4 border-t border-black/[0.05] dark:border-white/[0.05]">
                <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-2 px-1">
                  Indexed Sources ({sources.length})
                </p>
                <SourceList sources={sources} />
              </div>
            )}
          </>
        )}

        {!isWorkspace && (
          <>
            <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-2 px-1">
              Your Sources ({sources.length})
            </p>
            {sources.length === 0 ? (
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 px-1 italic">No sources added.</p>
            ) : (
              <SourceList sources={sources} />
            )}
          </>
        )}
      </div>

      <AddSourceModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />
    </div>
  )
}
