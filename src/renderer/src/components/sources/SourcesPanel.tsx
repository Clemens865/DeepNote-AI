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
      <div className="h-full flex flex-col items-center pt-4 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
        <button
          onClick={onToggle}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Show sources"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
      <div className="p-5">
        {/* Notebook identity */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 dark:bg-indigo-500 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-200 dark:shadow-indigo-900/50">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 dark:text-slate-100 text-[15px] leading-tight truncate">
                {currentNotebook?.title || 'DeepNote AI'}
              </h1>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {sources.length} source{sources.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onToggle}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Collapse sources"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Add Source button (always available) */}
        <button
          onClick={() => setShowAddModal(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-500/15 transition-colors font-semibold text-sm shadow-sm"
        >
          <Plus size={18} />
          Add Source
        </button>
      </div>

      {/* Navigation */}
      <div className="px-5 mb-4">
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] mb-2 px-1">
          Navigation
        </p>
        <div className="space-y-1">
          <button
            onClick={() => setActiveView('chat')}
            className={`flex items-center gap-3 px-3 py-2.5 w-full rounded-xl transition-all duration-200 text-sm ${
              activeView === 'chat'
                ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
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
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
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
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
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
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] mb-2 px-1">
                  Indexed Sources ({sources.length})
                </p>
                <SourceList sources={sources} />
              </div>
            )}
          </>
        )}

        {!isWorkspace && (
          <>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] mb-2 px-1">
              Your Sources ({sources.length})
            </p>
            {sources.length === 0 ? (
              <p className="text-[11px] text-slate-400 dark:text-slate-500 px-1 italic">No sources added.</p>
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
