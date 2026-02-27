import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { ToolGrid } from './ToolGrid'
import { GeneratedContentView } from './GeneratedContentView'
import { ImageSlidesWizard } from './ImageSlidesWizard'
import { StudioCustomizeDialog } from './StudioCustomizeDialog'
import { ReportFormatDialog } from './ReportFormatDialog'
import { InfographicWizard } from './InfographicWizard'
import { WhitePaperWizard } from './WhitePaperWizard'
import { HtmlPresentationWizard } from './HtmlPresentationWizard'
import { useNotebookStore } from '../../stores/notebookStore'
import {
  PanelRightOpen,
  PanelRightClose,
  LayoutGrid,
  MoreVertical,
  Pencil,
  Trash2,
  Search,
  X,
} from 'lucide-react'
import type { GeneratedContent, StudioToolOptions } from '@shared/types'

const TYPE_LABELS: Record<string, string> = {
  audio: 'Audio',
  slides: 'Slides',
  'image-slides': 'Slides',
  flashcard: 'Flashcards',
  report: 'Report',
  mindmap: 'Mind Map',
  quiz: 'Quiz',
  datatable: 'Table',
  infographic: 'Infographic',
  dashboard: 'Dashboard',
  'literature-review': 'Lit. Review',
  'competitive-analysis': 'Comp. Analysis',
  diff: 'Diff',
  'citation-graph': 'Citation Graph',
  whitepaper: 'White Paper',
  'html-presentation': 'Web Deck',
  canvas: 'Canvas',
}

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
  const [showReportFormat, setShowReportFormat] = useState(false)
  const [reportFormatGenerating, setReportFormatGenerating] = useState(false)
  const [showInfographicWizard, setShowInfographicWizard] = useState(false)
  const [showWhitePaperWizard, setShowWhitePaperWizard] = useState(false)
  const [showHtmlPresentationWizard, setShowHtmlPresentationWizard] = useState(false)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title' | 'type'>('newest')
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

  const availableTypes = useMemo(() => {
    const types = new Set(generatedItems.map((item) => item.type))
    return Array.from(types).sort()
  }, [generatedItems])

  const filteredItems = useMemo(() => {
    let items = generatedItems

    if (filterType !== 'all') {
      items = items.filter((item) => item.type === filterType)
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      items = items.filter((item) => item.title.toLowerCase().includes(q))
    }

    switch (sortBy) {
      case 'oldest':
        items = [...items].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
        break
      case 'title':
        items = [...items].sort((a, b) => a.title.localeCompare(b.title))
        break
      case 'type':
        items = [...items].sort(
          (a, b) =>
            a.type.localeCompare(b.type) ||
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        break
      case 'newest':
      default:
        // Already in newest-first order from the API
        break
    }

    return items
  }, [generatedItems, filterType, searchQuery, sortBy])

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

  const handleReportFormatGenerate = async (options: StudioToolOptions) => {
    if (!currentNotebook) return
    setReportFormatGenerating(true)
    try {
      const result = (await window.api.studioGenerate({
        notebookId: currentNotebook.id,
        type: 'report',
        options: { ...options },
      })) as GeneratedContent
      if (result) {
        setGeneratedItems((prev) => [result, ...prev])
        setViewing(result)
      }
      setShowReportFormat(false)
    } catch (err) {
      console.error('Report generation failed:', err)
    } finally {
      setReportFormatGenerating(false)
    }
  }

  const handleInfographicComplete = async (contentId: string) => {
    setShowInfographicWizard(false)
    const content = (await window.api.studioStatus(contentId)) as GeneratedContent | null
    if (content) {
      setGeneratedItems((prev) => [content, ...prev])
      setViewing(content)
    }
  }

  const handleWhitePaperComplete = async (contentId: string) => {
    setShowWhitePaperWizard(false)
    const content = (await window.api.studioStatus(contentId)) as GeneratedContent | null
    if (content) {
      setGeneratedItems((prev) => [content, ...prev])
      setViewing(content)
    }
  }

  const handleHtmlPresentationComplete = async (contentId: string) => {
    setShowHtmlPresentationWizard(false)
    const content = (await window.api.studioStatus(contentId)) as GeneratedContent | null
    if (content) {
      setGeneratedItems((prev) => [content, ...prev])
      setViewing(content)
    }
  }

  const handleStartCanvas = async () => {
    if (!currentNotebook) return
    try {
      const result = (await window.api.studioGenerate({
        notebookId: currentNotebook.id,
        type: 'canvas',
      })) as GeneratedContent
      if (result) {
        setGeneratedItems((prev) => [result, ...prev])
        setViewing(result)
      }
    } catch (err) {
      console.error('Canvas creation failed:', err)
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
      <div className="h-full flex flex-col items-center pt-4 bg-white/40 dark:bg-black/40 backdrop-blur-xl">
        <button
          onClick={onToggle}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-colors"
          title="Show studio"
        >
          <PanelRightOpen className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-white/40 dark:bg-black/40 backdrop-blur-xl border-l border-black/[0.06] dark:border-white/[0.06]">
      <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="flex items-center gap-2">
          <LayoutGrid size={18} className="text-zinc-500 dark:text-zinc-400" />
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Studio</h2>
        </div>
        <button
          onClick={onToggle}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-colors"
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
              onOpenReportFormat={() => setShowReportFormat(true)}
              onStartInfographic={() => setShowInfographicWizard(true)}
              onStartWhitePaper={() => setShowWhitePaperWizard(true)}
              onStartHtmlPresentation={() => setShowHtmlPresentationWizard(true)}
              onStartCanvas={handleStartCanvas}
            />

            {generatedItems.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                  Generated Content ({filteredItems.length})
                </p>

                {/* Search input */}
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 pointer-events-none"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search…"
                    className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-black/[0.06] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02] text-zinc-700 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none focus:border-indigo-500/50 transition-colors"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Type filter chips + sort */}
                <div className="flex items-start gap-1.5 flex-wrap">
                  <button
                    onClick={() => setFilterType('all')}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                      filterType === 'all'
                        ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300'
                        : 'bg-black/[0.04] dark:bg-white/[0.04] text-zinc-500 dark:text-zinc-400 hover:bg-black/[0.08] dark:hover:bg-white/[0.08]'
                    }`}
                  >
                    All
                  </button>
                  {availableTypes.map((t) => (
                    <button
                      key={t}
                      onClick={() => setFilterType(filterType === t ? 'all' : t)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                        filterType === t
                          ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300'
                          : 'bg-black/[0.04] dark:bg-white/[0.04] text-zinc-500 dark:text-zinc-400 hover:bg-black/[0.08] dark:hover:bg-white/[0.08]'
                      }`}
                    >
                      {TYPE_LABELS[t] || t}
                    </button>
                  ))}
                  <select
                    value={sortBy}
                    onChange={(e) =>
                      setSortBy(e.target.value as 'newest' | 'oldest' | 'title' | 'type')
                    }
                    className="ml-auto px-1.5 py-0.5 rounded text-[10px] font-medium bg-black/[0.03] dark:bg-white/[0.03] text-zinc-500 dark:text-zinc-400 border border-black/[0.06] dark:border-white/[0.06] outline-none cursor-pointer"
                  >
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                    <option value="title">Title A-Z</option>
                    <option value="type">Type</option>
                  </select>
                </div>

                {/* Empty filter state */}
                {filteredItems.length === 0 && (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center py-3">
                    No items match your search.
                  </p>
                )}

                {filteredItems.map((item) => (
                  <div key={item.id} className="relative group">
                    {renamingId === item.id ? (
                      <div className="px-4 py-3 rounded-xl border border-indigo-400 dark:border-indigo-500 bg-white/80 dark:bg-white/[0.03]">
                        <input
                          ref={renameInputRef}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={handleFinishRename}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleFinishRename()
                            if (e.key === 'Escape') setRenamingId(null)
                          }}
                          className="w-full text-sm font-medium text-zinc-800 dark:text-zinc-200 bg-transparent outline-none"
                        />
                      </div>
                    ) : (
                      <button
                        onClick={() => setViewing(item)}
                        className="w-full text-left px-4 py-3 rounded-xl glass-panel glass-panel-hover pr-10"
                      >
                        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                          {item.title}
                        </p>
                        <p className="text-xs text-zinc-400 dark:text-zinc-500 capitalize mt-0.5">
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
                        className="absolute top-3 right-2 w-7 h-7 rounded-lg flex items-center justify-center text-zinc-300 dark:text-zinc-600 opacity-0 group-hover:opacity-100 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-all"
                      >
                        <MoreVertical size={14} />
                      </button>
                    )}

                    {/* Dropdown menu */}
                    {openMenu === item.id && (
                      <div
                        className="absolute right-2 top-10 z-20 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-black/[0.08] dark:border-white/[0.08] rounded-lg shadow-lg py-1 min-w-[120px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => handleStartRename(item)}
                          className="w-full text-left px-3 py-2 text-xs text-zinc-700 dark:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors flex items-center gap-2"
                        >
                          <Pencil size={12} />
                          Rename
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex items-center gap-2"
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

      {showReportFormat && currentNotebook && (
        <ReportFormatDialog
          notebookId={currentNotebook.id}
          onGenerate={handleReportFormatGenerate}
          onClose={() => {
            setShowReportFormat(false)
            setReportFormatGenerating(false)
          }}
          isGenerating={reportFormatGenerating}
        />
      )}

      {showInfographicWizard && currentNotebook && (
        <InfographicWizard
          notebookId={currentNotebook.id}
          onComplete={handleInfographicComplete}
          onClose={() => setShowInfographicWizard(false)}
        />
      )}

      {showWhitePaperWizard && currentNotebook && (
        <WhitePaperWizard
          notebookId={currentNotebook.id}
          onComplete={handleWhitePaperComplete}
          onClose={() => setShowWhitePaperWizard(false)}
        />
      )}

      {showHtmlPresentationWizard && currentNotebook && (
        <HtmlPresentationWizard
          notebookId={currentNotebook.id}
          onComplete={handleHtmlPresentationComplete}
          onClose={() => setShowHtmlPresentationWizard(false)}
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
