import { useState, useRef, useCallback, type ReactNode } from 'react'
import { Maximize2, Download, X } from 'lucide-react'
import { toPng, toSvg } from 'html-to-image'

interface ArtifactWrapperProps {
  title: string
  /** Optional extra buttons to show in the header (e.g. CSV copy) */
  headerActions?: ReactNode
  /** If provided, enables a JSON download button */
  jsonData?: unknown
  children: ReactNode
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = filename
  link.href = url
  link.click()
  URL.revokeObjectURL(url)
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a')
  link.download = filename
  link.href = dataUrl
  link.click()
}

export function ArtifactWrapper({ title, headerActions, jsonData, children }: ArtifactWrapperProps) {
  const [expanded, setExpanded] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  const baseName = title.replace(/\s+/g, '-').toLowerCase()

  const handleSavePng = useCallback(async () => {
    if (!contentRef.current) return
    try {
      const dataUrl = await toPng(contentRef.current, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      })
      downloadDataUrl(dataUrl, `${baseName}.png`)
    } catch (err) {
      console.error('Failed to save artifact as PNG:', err)
    }
  }, [baseName])

  const handleSaveSvg = useCallback(async () => {
    if (!contentRef.current) return
    try {
      const dataUrl = await toSvg(contentRef.current, { backgroundColor: '#ffffff' })
      downloadDataUrl(dataUrl, `${baseName}.svg`)
    } catch (err) {
      console.error('Failed to save artifact as SVG:', err)
    }
  }, [baseName])

  const handleSaveJson = useCallback(() => {
    if (!jsonData) return
    downloadFile(JSON.stringify(jsonData, null, 2), `${baseName}.json`, 'application/json')
  }, [baseName, jsonData])

  const exportButtons = (compact: boolean) => (
    <>
      {headerActions}
      <button
        onClick={handleSavePng}
        title="Save as PNG"
        className={compact
          ? 'flex items-center gap-1 text-[10px] text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors'
          : 'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-zinc-500 dark:text-zinc-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors'
        }
      >
        <Download size={compact ? 10 : 13} />
        PNG
      </button>
      <button
        onClick={handleSaveSvg}
        title="Save as SVG"
        className={compact
          ? 'flex items-center gap-1 text-[10px] text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors'
          : 'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-zinc-500 dark:text-zinc-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors'
        }
      >
        SVG
      </button>
      {jsonData && (
        <button
          onClick={handleSaveJson}
          title="Save as JSON"
          className={compact
            ? 'flex items-center gap-1 text-[10px] text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors'
            : 'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-zinc-500 dark:text-zinc-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors'
          }
        >
          JSON
        </button>
      )}
    </>
  )

  const header = (
    <div className="flex items-center justify-between px-3 py-1.5 bg-black/[0.02] dark:bg-white/[0.03] border-b border-black/[0.06] dark:border-white/[0.06]">
      <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
        {title}
      </span>
      <div className="flex items-center gap-1.5">
        {exportButtons(true)}
        <button
          onClick={() => setExpanded(true)}
          title="Expand"
          className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
        >
          <Maximize2 size={12} />
        </button>
      </div>
    </div>
  )

  // Inline (normal) view
  if (!expanded) {
    return (
      <div className="my-2 rounded-lg border border-black/[0.06] dark:border-white/[0.06] overflow-hidden">
        {header}
        <div ref={contentRef}>
          {children}
        </div>
      </div>
    )
  }

  // Fullscreen modal
  return (
    <>
      {/* Collapsed placeholder in the chat flow */}
      <div className="my-2 rounded-lg border border-black/[0.06] dark:border-white/[0.06] overflow-hidden">
        <div className="flex items-center justify-between px-3 py-1.5 bg-black/[0.02] dark:bg-white/[0.03] border-b border-black/[0.06] dark:border-white/[0.06]">
          <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
            {title}
          </span>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 italic">Expanded below</span>
        </div>
      </div>

      {/* Fullscreen overlay */}
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-black/[0.06] dark:border-white/[0.06] w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
          {/* Modal header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-black/[0.06] dark:border-white/[0.04] flex-shrink-0">
            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{title}</span>
            <div className="flex items-center gap-2">
              {exportButtons(false)}
              <button
                onClick={() => setExpanded(false)}
                title="Close"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          {/* Modal content */}
          <div ref={contentRef} className="flex-1 overflow-auto">
            {children}
          </div>
        </div>
      </div>
    </>
  )
}
