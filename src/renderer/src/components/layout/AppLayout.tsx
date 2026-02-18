import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Header } from './Header'

export function AppLayout() {
  // Listen for tray "Add to Notebook" events and auto-ingest
  useEffect(() => {
    const cleanup = window.api.onClipboardAddToNotebook(async (data) => {
      try {
        await window.api.clipboardAddToNotebook({
          notebookId: data.notebookId,
          text: data.text,
          title: data.title,
        })
        console.log('[Clipboard] Added to notebook from tray:', data.notebookId)
      } catch (err) {
        console.error('[Clipboard] Failed to add to notebook:', err)
      }
    })
    return cleanup
  }, [])

  return (
    <div className="flex flex-col h-screen bg-slate-100 dark:bg-slate-950">
      <Header />
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
