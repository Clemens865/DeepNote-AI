import { useState, useEffect, useCallback, useRef } from 'react'
import { ToolGrid } from './ToolGrid'
import { GeneratedContentView } from './GeneratedContentView'
import { ImageSlidesWizard } from './ImageSlidesWizard'
import { StudioCustomizeDialog } from './StudioCustomizeDialog'
import { useNotebookStore } from '../../stores/notebookStore'
import {
  PanelRightOpen,
  PanelRightClose,
  LayoutGrid,
  MoreVertical,
  Pencil,
  Trash2,
} from 'lucide-react'
import type { GeneratedContent, StudioToolOptions } from '@shared/types'

interface StudioPanelProps {
  collapsed: boolean
  onToggle: () => void
}

export function StudioPanel({ collapsed, onToggle }: StudioPanelProps) {
  const currentNotebook = useNotebookStore((s) => s.currentNotebook)
  const [generatedItems, setGeneratedItems] = useState<GeneratedContent[]>([])
  const [viewing, setViewing] = useState<GeneratedContent | null>(null)
  const [showImageSlidesWizard, setShowImageSlidesWizard] = useState(false)
  const [customizeTool, setCustomizeTool] = useState<{ id: string; label: string } | null>(null)
  const [customizeGenerating, setCustomizeGenerating] = useState(false)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  const loadItems = useCallback(async () => {
    if (!currentNotebook) return
    const items = (await window.api.studioList(currentNotebook.id)) as GeneratedContent[]
    setGeneratedItems(items)
  }, [currentNotebook])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  // Close menu on outside click
  useEffect(() => {
    if (!openMenu) return
    const handler = () => setOpenMenu(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [openMenu])

  // Focus rename input when entering rename mode
  useEffect(() => {
    if (renamingId) {
      renameInputRef.current?.focus()
      renameInputRef.current?.select()
    }
  }, [renamingId])

  const handleGenerated = (content: GeneratedContent) => {
    setGeneratedItems((prev) => [content, ...prev])
    setViewing(content)
  }

  const handleImageSlidesComplete = async (contentId: string) => {
    setShowImageSlidesWizard(false)
    const content = (await window.api.studioStatus(contentId)) as GeneratedContent | null
    if (content) {
      setGeneratedItems((prev) => [content, ...prev])
      setViewing(content)
    }
  }

  const handleCustomizeGenerate = async (options: StudioToolOptions) => {
    if (!currentNotebook || !customizeTool) return

    setCustomizeGenerating(true)
    try {
      const result = (await window.api.studioGenerate({
        notebookId: currentNotebook.id,
        type: customizeTool.id,
        options: { ...options },
      })) as GeneratedContent
      if (result) {
        setGeneratedItems((prev) => [result, ...prev])
        setViewing(result)
      }
      setCustomizeTool(null)
    } catch (err) {
      console.error('Customized generation failed:', err)
    } finally {
      setCustomizeGenerating(false)
    }
  }

  const handleDelete = async (id: string) => {
    setOpenMenu(null)
    await window.api.studioDelete(id)
    setGeneratedItems((prev) => prev.filter((item) => item.id !== id))
    if (viewing?.id === id) setViewing(null)
  }

  const handleStartRename = (item: GeneratedContent) => {
    setOpenMenu(null)
    setRenamingId(item.id)
    setRenameValue(item.title)
  }

  const handleFinishRename = async () => {
    if (!renamingId || !renameValue.trim()) {
      setRenamingId(null)
      return
    }
    await window.api.studioRename(renamingId, renameValue.trim())
    setGeneratedItems((prev) =>
      prev.map((item) =>
        item.id === renamingId ? { ...item, title: renameValue.trim() } : item
      )
    )
    setRenamingId(null)
  }

  if (collapsed) {
    return (
      <div className="h-full flex flex-col items-center pt-4 bg-white dark:bg-slate-900">
        <button
          onClick={onToggle}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Show studio"
        >
          <PanelRightOpen className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <LayoutGrid size={18} className="text-indigo-600 dark:text-indigo-400" />
          <h2 className="font-bold text-slate-800 dark:text-slate-100">Studio</h2>
        </div>
        <button
          onClick={onToggle}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Collapse studio"
        >
          <PanelRightClose className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-5">
        {viewing ? (
          <GeneratedContentView content={viewing} onBack={() => setViewing(null)} />
        ) : (
          <div className="space-y-6">
            <ToolGrid
              onGenerated={handleGenerated}
              onOpenImageSlidesWizard={() => setShowImageSlidesWizard(true)}
              onOpenCustomize={(toolId, toolLabel) =>
                setCustomizeTool({ id: toolId, label: toolLabel })
              }
            />

            {generatedItems.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em]">
                  Generated Content
                </p>
                {generatedItems.map((item) => (
                  <div key={item.id} className="relative group">
                    {renamingId === item.id ? (
                      <div className="px-4 py-3 rounded-xl border border-indigo-400 dark:border-indigo-500 bg-white dark:bg-slate-800">
                        <input
                          ref={renameInputRef}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={handleFinishRename}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleFinishRename()
                            if (e.key === 'Escape') setRenamingId(null)
                          }}
                          className="w-full text-sm font-medium text-slate-800 dark:text-slate-200 bg-transparent outline-none"
                        />
                      </div>
                    ) : (
                      <button
                        onClick={() => setViewing(item)}
                        className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-sm transition-all pr-10"
                      >
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                          {item.title}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 capitalize mt-0.5">
                          {item.type.replace('-', ' ')} &middot; {item.status}
                        </p>
                      </button>
                    )}

                    {/* 3-dot menu button */}
                    {renamingId !== item.id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenMenu(openMenu === item.id ? null : item.id)
                        }}
                        className="absolute top-3 right-2 w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                      >
                        <MoreVertical size={14} />
                      </button>
                    )}

                    {/* Dropdown menu */}
                    {openMenu === item.id && (
                      <div
                        className="absolute right-2 top-10 z-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 min-w-[120px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => handleStartRename(item)}
                          className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
                        >
                          <Pencil size={12} />
                          Rename
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="w-full text-left px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex items-center gap-2"
                        >
                          <Trash2 size={12} />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showImageSlidesWizard && currentNotebook && (
        <ImageSlidesWizard
          notebookId={currentNotebook.id}
          onComplete={handleImageSlidesComplete}
          onClose={() => setShowImageSlidesWizard(false)}
        />
      )}

      {customizeTool && (
        <StudioCustomizeDialog
          toolId={customizeTool.id}
          toolLabel={customizeTool.label}
          onGenerate={handleCustomizeGenerate}
          onClose={() => {
            setCustomizeTool(null)
            setCustomizeGenerating(false)
          }}
          isGenerating={customizeGenerating}
        />
      )}
    </div>
  )
}
