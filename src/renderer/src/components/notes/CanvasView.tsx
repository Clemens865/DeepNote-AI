import { useState, useEffect, useCallback, useRef } from 'react'
import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import { useNotebookStore } from '../../stores/notebookStore'
import { useAppStore } from '../../stores/appStore'
import { Plus, Trash2, Frame } from 'lucide-react'
import type { Canvas } from '@shared/types'
import type { ExcalidrawImperativeAPI, ExcalidrawInitialDataState } from '@excalidraw/excalidraw/types'

export function CanvasView() {
  const currentNotebook = useNotebookStore((s) => s.currentNotebook)
  const darkMode = useAppStore((s) => s.darkMode)
  const [canvases, setCanvases] = useState<Canvas[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null)
  const selectedIdRef = useRef<string | null>(null)

  selectedIdRef.current = selectedId

  const loadCanvases = useCallback(async () => {
    if (!currentNotebook) return
    const list = await window.api.canvasList(currentNotebook.id) as Canvas[]
    setCanvases(list)
  }, [currentNotebook])

  useEffect(() => {
    loadCanvases()
  }, [loadCanvases])

  const saveCurrentCanvas = useCallback(() => {
    const api = apiRef.current
    const id = selectedIdRef.current
    if (!api || !id) return
    const elements = api.getSceneElements()
    const appState = api.getAppState()
    const data = {
      elements: JSON.parse(JSON.stringify(elements)),
      appState: {
        viewBackgroundColor: appState.viewBackgroundColor,
        gridSize: appState.gridSize,
      },
    }
    window.api.canvasUpdate(id, { data })
  }, [])

  const handleCreate = async () => {
    if (!currentNotebook) return
    saveCurrentCanvas()
    const canvas = await window.api.canvasCreate({ notebookId: currentNotebook.id }) as Canvas
    setCanvases((prev) => [...prev, canvas])
    setSelectedId(canvas.id)
  }

  const handleDelete = async (id: string) => {
    await window.api.canvasDelete(id)
    setCanvases((prev) => prev.filter((c) => c.id !== id))
    if (selectedId === id) {
      setSelectedId(null)
      apiRef.current = null
    }
  }

  const handleSelect = (id: string) => {
    saveCurrentCanvas()
    apiRef.current = null
    setSelectedId(id)
  }

  const handleChange = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveCurrentCanvas()
    }, 1000)
  }, [saveCurrentCanvas])

  const selectedCanvas = canvases.find((c) => c.id === selectedId)

  // Build initial data from saved canvas
  const initialData: ExcalidrawInitialDataState | undefined = selectedCanvas?.data &&
    Array.isArray((selectedCanvas.data as Record<string, unknown>).elements)
    ? {
        elements: (selectedCanvas.data as Record<string, unknown>).elements as ExcalidrawInitialDataState['elements'],
        appState: (selectedCanvas.data as Record<string, unknown>).appState as ExcalidrawInitialDataState['appState'],
      }
    : undefined

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-[200px] flex-shrink-0 border-r border-black/[0.06] dark:border-white/[0.06] bg-white/60 dark:bg-black/40 flex flex-col">
        <div className="p-3 border-b border-black/[0.06] dark:border-white/[0.06]">
          <button
            onClick={handleCreate}
            className="w-full flex items-center justify-center gap-2 py-2 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-lg text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all"
          >
            <Plus size={16} />
            New Canvas
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {canvases.map((canvas) => (
            <div
              key={canvas.id}
              onClick={() => handleSelect(canvas.id)}
              onMouseEnter={() => setHoveredId(canvas.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={`flex items-center justify-between px-3 py-2.5 mx-1 rounded-lg cursor-pointer transition-colors text-sm ${
                selectedId === canvas.id
                  ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
              }`}
            >
              <span className="truncate">{canvas.title}</span>
              {hoveredId === canvas.id && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(canvas.id) }}
                  className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 min-w-0 relative">
        {selectedCanvas ? (
          <div className="excalidraw-container" key={selectedCanvas.id} style={{ position: 'absolute', inset: 0 }}>
            <Excalidraw
              excalidrawAPI={(api) => { apiRef.current = api }}
              initialData={initialData}
              onChange={handleChange}
              theme={darkMode ? 'dark' : 'light'}
            />
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500">
            <Frame size={48} className="mb-4 opacity-30" />
            <p className="text-lg font-medium mb-1">No canvas selected</p>
            <p className="text-sm">
              {canvases.length === 0
                ? 'Create your first canvas to get started'
                : 'Select a canvas from the sidebar'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
