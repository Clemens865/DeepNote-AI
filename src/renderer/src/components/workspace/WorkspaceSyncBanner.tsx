import { RefreshCw, X, Loader2 } from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useNotebookStore } from '../../stores/notebookStore'

export function WorkspaceSyncBanner() {
  const { diffResult, setDiffResult, syncing, setSyncing, setTree, setScanning } = useWorkspaceStore()
  const currentNotebook = useNotebookStore((s) => s.currentNotebook)

  if (!diffResult) return null

  const changedCount = diffResult.added.length + diffResult.modified.length + diffResult.deleted.length
  if (changedCount === 0) return null

  const handleSync = async () => {
    if (!currentNotebook || syncing) return
    setSyncing(true)
    try {
      await window.api.workspaceSync(currentNotebook.id)
      // Refresh tree and sources
      setScanning(true)
      const tree = await window.api.workspaceScan(currentNotebook.id)
      setTree(tree as never)
      setScanning(false)
      const sources = await window.api.listSources(currentNotebook.id)
      useNotebookStore.getState().setSources(sources as never[])
      setDiffResult(null)
    } catch (err) {
      console.error('Sync failed:', err)
    } finally {
      setSyncing(false)
    }
  }

  const parts: string[] = []
  if (diffResult.added.length > 0) parts.push(`${diffResult.added.length} new`)
  if (diffResult.modified.length > 0) parts.push(`${diffResult.modified.length} changed`)
  if (diffResult.deleted.length > 0) parts.push(`${diffResult.deleted.length} deleted`)

  return (
    <div className="mx-2 mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs">
      <span className="flex-1 truncate">{parts.join(', ')} file{changedCount !== 1 ? 's' : ''} since last session</span>
      <button
        onClick={handleSync}
        disabled={syncing}
        className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-100 dark:bg-amber-500/20 hover:bg-amber-200 dark:hover:bg-amber-500/30 transition-colors font-medium"
      >
        {syncing ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <RefreshCw className="w-3 h-3" />
        )}
        Re-index
      </button>
      <button
        onClick={() => setDiffResult(null)}
        className="p-0.5 rounded hover:bg-amber-200 dark:hover:bg-amber-500/20 transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}
