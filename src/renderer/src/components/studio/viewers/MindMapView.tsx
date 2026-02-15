import { useState, useCallback } from 'react'
import { ChevronRight, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
import { FullscreenWrapper } from './FullscreenWrapper'

interface MindMapViewProps {
  data: Record<string, unknown>
  isFullscreen: boolean
  onCloseFullscreen: () => void
  title: string
}

interface MindMapBranch {
  label: string
  children?: MindMapBranch[]
}

const NODE_COLORS = [
  { bg: 'bg-indigo-100 dark:bg-indigo-500/20', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-500/30' },
  { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-500/30' },
  { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-500/30' },
  { bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-500/30' },
]

function MindMapNode({
  branch,
  path,
  depth,
  collapsed,
  onToggle,
}: {
  branch: MindMapBranch
  path: string
  depth: number
  collapsed: Set<string>
  onToggle: (path: string) => void
}) {
  const hasChildren = branch.children && branch.children.length > 0
  const isCollapsed = collapsed.has(path)
  const color = NODE_COLORS[depth % NODE_COLORS.length]

  return (
    <div className="flex items-start gap-3">
      {/* Node */}
      <button
        onClick={() => hasChildren && onToggle(path)}
        className={`flex items-center gap-1.5 min-w-[140px] max-w-[220px] px-3 py-2 rounded-lg border text-xs font-medium transition-all ${color.bg} ${color.text} ${color.border} ${hasChildren ? 'cursor-pointer hover:shadow-md' : 'cursor-default'}`}
      >
        {hasChildren && (
          <ChevronRight
            size={12}
            className={`flex-shrink-0 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}
          />
        )}
        <span className="truncate">{branch.label}</span>
      </button>

      {/* Children */}
      {hasChildren && !isCollapsed && (
        <div className="mindmap-children flex flex-col gap-2 pt-1">
          {branch.children!.map((child, i) => (
            <div key={i} className="mindmap-node-row">
              <MindMapNode
                branch={child}
                path={`${path}.${i}`}
                depth={depth + 1}
                collapsed={collapsed}
                onToggle={onToggle}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MindMapContent({ data, maxHeight = '500px' }: { data: Record<string, unknown>; maxHeight?: string }) {
  const mapTitle = data.title as string | undefined
  const branches = data.branches as MindMapBranch[] | undefined
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [zoom, setZoom] = useState(1)

  const onToggle = useCallback((path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  if (!branches) return null

  return (
    <div className="space-y-3">
      {/* Zoom controls */}
      <div className="flex items-center gap-1 justify-end">
        <button
          onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Zoom in"
        >
          <ZoomIn size={14} />
        </button>
        <button
          onClick={() => setZoom(1)}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Reset zoom"
        >
          <RotateCcw size={14} />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Zoom out"
        >
          <ZoomOut size={14} />
        </button>
        <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-1 w-8 text-center">
          {Math.round(zoom * 100)}%
        </span>
      </div>

      {/* Scrollable map container */}
      <div className="overflow-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 p-4 min-h-[200px]" style={{ maxHeight }}>
        <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }} className="transition-transform duration-150">
          <div className="flex items-start gap-4">
            {/* Root node */}
            {mapTitle && (
              <div className="flex items-center min-w-[160px] max-w-[260px] px-4 py-3 rounded-xl bg-indigo-600 dark:bg-indigo-500 text-white text-sm font-bold shadow-lg flex-shrink-0">
                {mapTitle}
              </div>
            )}

            {/* Branches */}
            <div className="flex flex-col gap-3">
              {branches.map((branch, i) => (
                <MindMapNode
                  key={i}
                  branch={branch}
                  path={String(i)}
                  depth={0}
                  collapsed={collapsed}
                  onToggle={onToggle}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function MindMapView({ data, isFullscreen, onCloseFullscreen, title }: MindMapViewProps) {
  return (
    <>
      <MindMapContent data={data} />
      <FullscreenWrapper isOpen={isFullscreen} onClose={onCloseFullscreen} title={title} wide>
        <MindMapContent data={data} maxHeight="calc(100vh - 120px)" />
      </FullscreenWrapper>
    </>
  )
}
