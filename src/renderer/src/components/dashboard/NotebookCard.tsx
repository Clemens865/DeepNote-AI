import { useState } from 'react'
import type { Notebook } from '@shared/types'
import { MoreVertical, Trash2, FolderOpen, Paintbrush } from 'lucide-react'
import { NotebookIcon } from '../common/NotebookIcon'

interface NotebookCardProps {
  notebook: Notebook
  onClick: () => void
  onDelete: () => void
  onCustomize: () => void
}

export function NotebookCard({ notebook, onClick, onDelete, onCustomize }: NotebookCardProps) {
  const [showMenu, setShowMenu] = useState(false)

  const timeAgo = getTimeAgo(notebook.updatedAt)

  const hasImage = !!notebook.cardBgImage
  const hasGradient = !!notebook.cardGradientFrom && !!notebook.cardGradientTo

  const encodedImagePath = hasImage
    ? `local-file://${encodeURI(notebook.cardBgImage!)}`
    : null

  const bgStyle: React.CSSProperties = hasImage
    ? {
        backgroundImage: `url(${encodedImagePath})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : hasGradient
      ? {
          background: `linear-gradient(135deg, ${notebook.cardGradientFrom}, ${notebook.cardGradientTo})`,
        }
      : {}

  const hasCustomBg = hasImage || hasGradient

  return (
    <div
      className={`group relative flex flex-col h-48 rounded-2xl border transition-all cursor-pointer shadow-sm overflow-hidden ${
        hasCustomBg
          ? 'border-white/20 dark:border-white/10 hover:border-white/40 dark:hover:border-white/30 hover:shadow-lg'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-100/50 dark:hover:shadow-slate-900/50'
      }`}
      style={bgStyle}
      onClick={onClick}
    >
      {/* Dark overlay only for images (needed for text readability over photos) */}
      {hasImage && (
        <div className="absolute inset-0 bg-black/25 dark:bg-black/35" />
      )}

      <div className="relative flex-1 p-5">
        <div className="flex items-start justify-between">
          <NotebookIcon iconId={notebook.emoji} size={28} />
          <div className="flex items-center gap-1 relative">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onCustomize()
              }}
              className={`opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                hasCustomBg
                  ? 'text-white/70 hover:text-white hover:bg-white/20'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <Paintbrush className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu(!showMenu)
              }}
              className={`opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                hasCustomBg
                  ? 'text-white/70 hover:text-white hover:bg-white/20'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
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
        <h3 className={`mt-3 text-sm font-semibold line-clamp-2 ${
          hasCustomBg
            ? 'text-white drop-shadow-md'
            : 'text-slate-800 dark:text-slate-100'
        }`}>
          {notebook.title}
        </h3>
      </div>
      <div className={`relative px-5 py-3 flex items-center justify-between ${
        hasCustomBg
          ? 'border-t border-white/10'
          : 'border-t border-slate-100 dark:border-slate-700/50'
      }`}>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${hasCustomBg ? 'text-white/60' : 'text-slate-400 dark:text-slate-500'}`}>{timeAgo}</span>
          {notebook.workspaceRootPath && (
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium ${
              hasCustomBg
                ? 'bg-white/15 text-white/80'
                : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            }`}>
              <FolderOpen className="w-2.5 h-2.5" />
              Workspace
            </span>
          )}
        </div>
        <span className={`text-xs ${hasCustomBg ? 'text-white/60' : 'text-slate-400 dark:text-slate-500'}`}>
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
