import { useState, useEffect, useRef } from 'react'
import { Download, ExternalLink, Maximize2 } from 'lucide-react'
import { FullscreenWrapper } from './FullscreenWrapper'

interface HtmlPresentationViewProps {
  data: Record<string, unknown>
  isFullscreen: boolean
  onCloseFullscreen: () => void
  title: string
}

export function HtmlPresentationView({ data, title }: HtmlPresentationViewProps) {
  const html = (data.html as string) || ''
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const prevHtmlRef = useRef<string>('')

  // Create a blob URL so the iframe can load external CDNs (GSAP, fonts)
  // srcDoc iframes in Electron get blocked by CSP for external resources
  useEffect(() => {
    if (!html || html === prevHtmlRef.current) return
    prevHtmlRef.current = html

    // Revoke previous blob URL
    if (blobUrl) URL.revokeObjectURL(blobUrl)

    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    setBlobUrl(url)

    return () => URL.revokeObjectURL(url)
  }, [html]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleExport = async () => {
    const safeName = title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60)
    await window.api.studioSaveHtml({ html, defaultName: `${safeName}.html` })
  }

  const handleOpenInBrowser = async () => {
    const safeName = title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60)
    await window.api.studioOpenHtmlTemp({ html, filename: `${safeName}.html` })
  }

  if (!html) {
    return (
      <div className="text-center py-12 text-zinc-400 dark:text-zinc-500 text-sm">
        No HTML content generated.
      </div>
    )
  }

  const actionButtons = (
    <div className="flex items-center gap-1.5">
      <button
        onClick={handleExport}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
        title="Export HTML"
      >
        <Download size={13} />
        Export HTML
      </button>
      <button
        onClick={handleOpenInBrowser}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
        title="Open in Browser"
      >
        <ExternalLink size={13} />
        Open in Browser
      </button>
    </div>
  )

  return (
    <div className="space-y-3">
      {/* Action bar */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
        >
          <Download size={13} />
          Export HTML
        </button>
        <button
          onClick={handleOpenInBrowser}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
        >
          <ExternalLink size={13} />
          Open in Browser
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setIsFullscreen(true)}
          className="px-2 py-1 rounded-lg text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
          title="Fullscreen"
        >
          <Maximize2 size={14} />
        </button>
      </div>

      {/* Inline preview — uses blob URL so CDN scripts (GSAP, fonts) can load */}
      <div className="rounded-xl overflow-hidden border border-black/[0.06] dark:border-white/[0.06] bg-black">
        {blobUrl && (
          <iframe
            src={blobUrl}
            className="w-full border-0"
            style={{ height: 500 }}
            title="HTML Presentation Preview"
          />
        )}
      </div>

      {/* Fullscreen */}
      <FullscreenWrapper
        isOpen={isFullscreen}
        onClose={() => setIsFullscreen(false)}
        title={title}
        actions={actionButtons}
        wide
      >
        {blobUrl && (
          <iframe
            src={blobUrl}
            className="w-full h-full border-0 rounded-lg"
            style={{ minHeight: 'calc(100vh - 120px)' }}
            title="HTML Presentation"
          />
        )}
      </FullscreenWrapper>
    </div>
  )
}
