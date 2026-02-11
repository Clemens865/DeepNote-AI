import { useCallback } from 'react'
import { useNotebookStore } from '../stores/notebookStore'
import type { Notebook } from '@shared/types'

export function useNotebooks() {
  const { notebooks, setNotebooks, addNotebook, removeNotebook, setLoading, loading } =
    useNotebookStore()

  const fetchNotebooks = useCallback(async () => {
    setLoading(true)
    try {
      const list = await window.api.listNotebooks()
      setNotebooks(list as Notebook[])
    } catch (err) {
      console.error('Failed to fetch notebooks:', err)
    } finally {
      setLoading(false)
    }
  }, [setNotebooks, setLoading])

  const createNotebook = useCallback(
    async (title: string, emoji: string, workspaceRootPath?: string) => {
      try {
        const notebook = await window.api.createNotebook({ title, emoji, workspaceRootPath })
        addNotebook(notebook as Notebook)
        return notebook as Notebook
      } catch (err) {
        console.error('Failed to create notebook:', err)
        return null
      }
    },
    [addNotebook]
  )

  const deleteNotebook = useCallback(
    async (id: string) => {
      try {
        await window.api.deleteNotebook(id)
        removeNotebook(id)
      } catch (err) {
        console.error('Failed to delete notebook:', err)
      }
    },
    [removeNotebook]
  )

  return { notebooks, loading, fetchNotebooks, createNotebook, deleteNotebook }
}
