import { create } from 'zustand'
import type { WorkspaceTreeNode, WorkspaceDiffResult } from '@shared/types'

interface WorkspaceState {
  tree: WorkspaceTreeNode | null
  diffResult: WorkspaceDiffResult | null
  scanning: boolean
  syncing: boolean
  expandedPaths: Set<string>
  indexingPaths: Set<string>
  editorTab: { relativePath: string; content: string; isDirty: boolean; isReadOnly: boolean } | null

  setTree: (tree: WorkspaceTreeNode | null) => void
  setDiffResult: (diff: WorkspaceDiffResult | null) => void
  setScanning: (v: boolean) => void
  setSyncing: (v: boolean) => void
  toggleExpanded: (path: string) => void
  setExpanded: (path: string, expanded: boolean) => void
  addIndexing: (path: string) => void
  removeIndexing: (path: string) => void
  openEditor: (relativePath: string, content: string, isReadOnly?: boolean) => void
  setEditorContent: (content: string) => void
  markEditorClean: () => void
  closeEditor: () => void
  reset: () => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  tree: null,
  diffResult: null,
  scanning: false,
  syncing: false,
  expandedPaths: new Set<string>(),
  indexingPaths: new Set<string>(),
  editorTab: null,

  setTree: (tree) => set({ tree }),
  setDiffResult: (diffResult) => set({ diffResult }),
  setScanning: (scanning) => set({ scanning }),
  setSyncing: (syncing) => set({ syncing }),

  toggleExpanded: (path) =>
    set((s) => {
      const next = new Set(s.expandedPaths)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return { expandedPaths: next }
    }),

  setExpanded: (path, expanded) =>
    set((s) => {
      const next = new Set(s.expandedPaths)
      if (expanded) next.add(path)
      else next.delete(path)
      return { expandedPaths: next }
    }),

  addIndexing: (path) =>
    set((s) => {
      const next = new Set(s.indexingPaths)
      next.add(path)
      return { indexingPaths: next }
    }),

  removeIndexing: (path) =>
    set((s) => {
      const next = new Set(s.indexingPaths)
      next.delete(path)
      return { indexingPaths: next }
    }),

  openEditor: (relativePath, content, isReadOnly = false) =>
    set({ editorTab: { relativePath, content, isDirty: false, isReadOnly } }),

  setEditorContent: (content) =>
    set((s) => {
      if (!s.editorTab) return s
      return { editorTab: { ...s.editorTab, content, isDirty: true } }
    }),

  markEditorClean: () =>
    set((s) => {
      if (!s.editorTab) return s
      return { editorTab: { ...s.editorTab, isDirty: false } }
    }),

  closeEditor: () => set({ editorTab: null }),

  reset: () =>
    set({
      tree: null,
      diffResult: null,
      scanning: false,
      syncing: false,
      expandedPaths: new Set(),
      indexingPaths: new Set(),
      editorTab: null,
    }),
}))
