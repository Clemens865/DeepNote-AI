import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import { ArtifactWrapper } from './ArtifactWrapper'
import { sanitizeMermaidCode } from '../../utils/mermaidSanitizer'

mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  securityLevel: 'strict',
  fontFamily: 'Inter, system-ui, sans-serif',
})

interface ChatArtifactMermaidProps {
  data: {
    title?: string
    code: string
  }
  onRegenerateMermaid?: (code: string) => void
}

let mermaidCounter = 0

export function ChatArtifactMermaid({ data, onRegenerateMermaid }: ChatArtifactMermaidProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [showCode, setShowCode] = useState(false)
  const [wasCorrected, setWasCorrected] = useState(false)
  const idRef = useRef(`mermaid-${Date.now()}-${mermaidCounter++}`)

  useEffect(() => {
    let cancelled = false
    const render = async () => {
      if (!containerRef.current) return

      // Attempt 1: try raw code
      try {
        await mermaid.parse(data.code)
        const { svg } = await mermaid.render(idRef.current, data.code)
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg
          setError(null)
          setWasCorrected(false)
        }
        return
      } catch {
        // Attempt 1 failed — try sanitized
      }

      // Attempt 2: sanitize and retry with a fresh render ID
      try {
        const sanitized = sanitizeMermaidCode(data.code)
        const retryId = `mermaid-retry-${Date.now()}-${mermaidCounter++}`
        await mermaid.parse(sanitized)
        const { svg } = await mermaid.render(retryId, sanitized)
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg
          setError(null)
          setWasCorrected(true)
        }
        return
      } catch (e) {
        // Both attempts failed
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to render diagram')
          setWasCorrected(false)
        }
      }
    }
    render()
    return () => { cancelled = true }
  }, [data.code])

  const handleRegenerate = () => {
    onRegenerateMermaid?.(data.code)
  }

  return (
    <ArtifactWrapper title={data.title || 'Diagram'} jsonData={data}>
      <div className="p-4 bg-white dark:bg-slate-900 overflow-x-auto">
        {error ? (
          <div className="space-y-3">
            <div className="text-xs text-red-500 dark:text-red-400 p-2 bg-red-50 dark:bg-red-500/10 rounded-lg border border-red-200 dark:border-red-500/20">
              Diagram render error: {error}
            </div>
            <div className="flex items-center gap-2">
              {onRegenerateMermaid && (
                <button
                  onClick={handleRegenerate}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/15 transition-colors border border-indigo-200 dark:border-indigo-500/20"
                >
                  Regenerate Diagram
                </button>
              )}
              <button
                onClick={() => setShowCode(!showCode)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700"
              >
                {showCode ? 'Hide Code' : 'Show Code'}
              </button>
            </div>
            {showCode && (
              <pre className="text-xs font-mono bg-slate-900 dark:bg-slate-950 text-slate-100 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                {data.code}
              </pre>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div ref={containerRef} className="mermaid-container [&_svg]:max-w-full" />
            {wasCorrected && (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 italic">
                Auto-corrected syntax
              </p>
            )}
          </div>
        )}
      </div>
    </ArtifactWrapper>
  )
}
