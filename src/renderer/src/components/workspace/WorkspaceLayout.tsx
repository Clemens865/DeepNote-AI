import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useNotebookStore } from '../../stores/notebookStore'
import { useAppStore } from '../../stores/appStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { ResizablePanel } from '../layout/ResizablePanel'
import { SourcesPanel } from '../sources/SourcesPanel'
import { ChatPanel } from '../chat/ChatPanel'
import { NotesPanel } from '../notes/NotesPanel'
import { StudioPanel } from '../studio/StudioPanel'
import { FileEditor } from './FileEditor'
import type { Notebook, WorkspaceDiffResult } from '@shared/types'

export function WorkspaceLayout() {
  const { id } = useParams<{ id: string }>()
  const { setCurrentNotebook, setSources } = useNotebookStore()
  const { sourcesCollapsed, studioCollapsed, toggleSources, toggleStudio, activeView, setActiveView } = useAppStore()
  const { setDiffResult, reset: resetWorkspace } = useWorkspaceStore()

  useEffect(() => {
    if (!id) return

    const loadNotebook = async () => {
      const notebook = await window.api.getNotebook(id)
      setCurrentNotebook(notebook as Notebook | null)

      if (notebook) {
        const sources = await window.api.listSources(id)
        setSources(sources as never[])

        // If workspace notebook, check for changes
        const nb = notebook as Notebook
        if (nb.workspaceRootPath) {
          try {
            const diff = await window.api.workspaceDiff(id)
            const diffResult = diff as WorkspaceDiffResult
            const hasChanges =
              diffResult.added.length > 0 ||
              diffResult.modified.length > 0 ||
              diffResult.deleted.length > 0
            if (hasChanges) {
              setDiffResult(diffResult)
            }
          } catch (err) {
            console.error('Failed to check workspace diff:', err)
          }
        }
      }
    }

    loadNotebook()

    return () => {
      setCurrentNotebook(null)
      setSources([])
      resetWorkspace()
      setActiveView('chat')
    }
  }, [id, setCurrentNotebook, setSources, setDiffResult, resetWorkspace, setActiveView])

  const renderCenterPanel = () => {
    switch (activeView) {
      case 'editor':
        return <FileEditor />
      case 'notes':
        return <NotesPanel />
      case 'chat':
      default:
        return <ChatPanel />
    }
  }

  return (
    <div className="flex h-full">
      <ResizablePanel
        defaultWidth={280}
        minWidth={200}
        maxWidth={400}
        side="left"
        collapsed={sourcesCollapsed}
      >
        <SourcesPanel collapsed={sourcesCollapsed} onToggle={toggleSources} />
      </ResizablePanel>

      <div className="flex-1 min-w-0 flex flex-col bg-slate-50 dark:bg-slate-950">
        <div className="flex-1 min-h-0 flex flex-col">
          {renderCenterPanel()}
        </div>
      </div>

      <ResizablePanel
        defaultWidth={340}
        minWidth={280}
        maxWidth={500}
        side="right"
        collapsed={studioCollapsed}
      >
        <StudioPanel collapsed={studioCollapsed} onToggle={toggleStudio} />
      </ResizablePanel>
    </div>
  )
}
