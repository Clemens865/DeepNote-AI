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
          ? 'flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors'
          : 'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors'
        }
      >
        <Download size={compact ? 10 : 13} />
        PNG
      </button>
      <button
        onClick={handleSaveSvg}
        title="Save as SVG"
        className={compact
          ? 'flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors'
          : 'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors'
        }
      >
        SVG
      </button>
      {jsonData && (
        <button
          onClick={handleSaveJson}
          title="Save as JSON"
          className={compact
            ? 'flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors'
            : 'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors'
          }
        >
          JSON
        </button>
      )}
    </>
  )

  const header = (
    <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
        {title}
      </span>
      <div className="flex items-center gap-1.5">
        {exportButtons(true)}
        <button
          onClick={() => setExpanded(true)}
          title="Expand"
          className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          <Maximize2 size={12} />
        </button>
      </div>
    </div>
  )

  // Inline (normal) view
  if (!expanded) {
    return (
      <div className="my-2 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
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
      <div className="my-2 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            {title}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 italic">Expanded below</span>
        </div>
      </div>

      {/* Fullscreen overlay */}
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
          {/* Modal header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</span>
            <div className="flex items-center gap-2">
              {exportButtons(false)}
              <button
                onClick={() => setExpanded(false)}
                title="Close"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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
