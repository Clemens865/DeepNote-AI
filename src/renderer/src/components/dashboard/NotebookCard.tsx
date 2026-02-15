import { useState } from 'react'
import type { Notebook } from '@shared/types'
import { MoreVertical, Trash2, FolderOpen } from 'lucide-react'
import { NotebookIcon } from '../common/NotebookIcon'

interface NotebookCardProps {
  notebook: Notebook
  onClick: () => void
  onDelete: () => void
}

export function NotebookCard({ notebook, onClick, onDelete }: NotebookCardProps) {
  const [showMenu, setShowMenu] = useState(false)

  const timeAgo = getTimeAgo(notebook.updatedAt)

  return (
    <div
      className="group relative flex flex-col h-48 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-100/50 dark:hover:shadow-slate-900/50 transition-all cursor-pointer shadow-sm"
      onClick={onClick}
    >
      <div className="flex-1 p-5">
        <div className="flex items-start justify-between">
          <NotebookIcon iconId={notebook.emoji} size={28} />
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu(!showMenu)
              }}
              className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-9 w-36 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-20 py-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowMenu(false)
                    onDelete()
                  }}
                  className="w-full flex items-center gap-2 text-left px-4 py-2 text-sm text-red-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
        <h3 className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-2">
          {notebook.title}
        </h3>
      </div>
      <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 dark:text-slate-500">{timeAgo}</span>
          {notebook.workspaceRootPath && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium">
              <FolderOpen className="w-2.5 h-2.5" />
              Workspace
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {notebook.sourceCount || 0} source{(notebook.sourceCount || 0) !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  )
}

function getTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}
