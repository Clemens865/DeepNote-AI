import { create } from 'zustand'

interface AppState {
  sidebarCollapsed: boolean
  studioCollapsed: boolean
  sourcesCollapsed: boolean
  activeView: 'chat' | 'notes' | 'editor'
  darkMode: boolean
  toggleSidebar: () => void
  toggleStudio: () => void
  toggleSources: () => void
  setSidebarCollapsed: (v: boolean) => void
  setStudioCollapsed: (v: boolean) => void
  setSourcesCollapsed: (v: boolean) => void
  setActiveView: (v: 'chat' | 'notes' | 'editor') => void
  toggleDarkMode: () => void
}

const getInitialDarkMode = (): boolean => {
  try {
    const stored = localStorage.getItem('deepnote-dark')
    if (stored !== null) return stored === 'true'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

const applyDarkMode = (dark: boolean) => {
  if (dark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
  try {
    localStorage.setItem('deepnote-dark', String(dark))
  } catch { /* ignore */ }
}

const initialDark = getInitialDarkMode()
applyDarkMode(initialDark)

export const useAppStore = create<AppState>((set) => ({
  sidebarCollapsed: false,
  studioCollapsed: false,
  sourcesCollapsed: false,
  activeView: 'chat',
  darkMode: initialDark,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleStudio: () => set((s) => ({ studioCollapsed: !s.studioCollapsed })),
  toggleSources: () => set((s) => ({ sourcesCollapsed: !s.sourcesCollapsed })),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  setStudioCollapsed: (v) => set({ studioCollapsed: v }),
  setSourcesCollapsed: (v) => set({ sourcesCollapsed: v }),
  setActiveView: (v) => set({ activeView: v }),
  toggleDarkMode: () =>
    set((s) => {
      const next = !s.darkMode
      applyDarkMode(next)
      return { darkMode: next }
    }),
}))
