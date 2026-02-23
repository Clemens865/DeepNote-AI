import { useEffect } from 'react'
import { Loader2, FolderOpen, RefreshCw } from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useNotebookStore } from '../../stores/notebookStore'
import { FileTreeNode } from './FileTreeNode'

export function FileTreeView() {
  const currentNotebook = useNotebookStore((s) => s.currentNotebook)
  const { tree, scanning, setTree, setScanning } = useWorkspaceStore()

  useEffect(() => {
    if (!currentNotebook?.workspaceRootPath) return

    const loadTree = async () => {
      setScanning(true)
      try {
        const result = await window.api.workspaceScan(currentNotebook.id)
        setTree(result as never)
      } catch (err) {
        console.error('Failed to scan workspace:', err)
      } finally {
        setScanning(false)
      }
    }

    loadTree()
  }, [currentNotebook?.id, currentNotebook?.workspaceRootPath, setTree, setScanning])

  const handleRefresh = async () => {
    if (!currentNotebook) return
    setScanning(true)
    try {
      const result = await window.api.workspaceScan(currentNotebook.id)
      setTree(result as never)
    } catch (err) {
      console.error('Failed to refresh workspace:', err)
    } finally {
      setScanning(false)
    }
  }

  if (scanning && !tree) {
    return (
      <div className="flex items-center justify-center py-8 text-zinc-400 dark:text-zinc-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span className="text-sm">Scanning files...</span>
      </div>
    )
  }

  if (!tree || !tree.children || tree.children.length === 0) {
    return (
      <div className="text-center py-6 text-zinc-400 dark:text-zinc-500">
        <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-xs">No files found in workspace</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.15em]">
          Workspace Files
        </p>
        <button
          onClick={handleRefresh}
          disabled={scanning}
          className="p-1 rounded-md text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors disabled:opacity-50"
          title="Refresh file tree"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <div className="space-y-0">
        {tree.children.map((child) => (
          <FileTreeNode key={child.relativePath} node={child} depth={0} />
        ))}
      </div>
    </div>
  )
}
