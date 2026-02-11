import { create } from 'zustand'
import type { Notebook, Source } from '@shared/types'

interface NotebookState {
  notebooks: Notebook[]
  currentNotebook: Notebook | null
  sources: Source[]
  loading: boolean
  setNotebooks: (notebooks: Notebook[]) => void
  setCurrentNotebook: (notebook: Notebook | null) => void
  setSources: (sources: Source[]) => void
  setLoading: (loading: boolean) => void
  addNotebook: (notebook: Notebook) => void
  removeNotebook: (id: string) => void
  updateNotebookInList: (id: string, data: Partial<Notebook>) => void
}

export const useNotebookStore = create<NotebookState>((set) => ({
  notebooks: [],
  currentNotebook: null,
  sources: [],
  loading: false,
  setNotebooks: (notebooks) => set({ notebooks }),
  setCurrentNotebook: (notebook) => set({ currentNotebook: notebook }),
  setSources: (sources) => set({ sources }),
  setLoading: (loading) => set({ loading }),
  addNotebook: (notebook) => set((s) => ({ notebooks: [notebook, ...s.notebooks] })),
  removeNotebook: (id) => set((s) => ({ notebooks: s.notebooks.filter((n) => n.id !== id) })),
  updateNotebookInList: (id, data) =>
    set((s) => ({
      notebooks: s.notebooks.map((n) => (n.id === id ? { ...n, ...data } : n)),
    })),
}))
