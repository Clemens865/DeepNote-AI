import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import { ArtifactWrapper } from './ArtifactWrapper'

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
}

let mermaidCounter = 0

export function ChatArtifactMermaid({ data }: ChatArtifactMermaidProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const idRef = useRef(`mermaid-${Date.now()}-${mermaidCounter++}`)

  useEffect(() => {
    let cancelled = false
    const render = async () => {
      if (!containerRef.current) return
      try {
        const { svg } = await mermaid.render(idRef.current, data.code)
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg
          setError(null)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to render diagram')
        }
      }
    }
    render()
    return () => { cancelled = true }
  }, [data.code])

  return (
    <ArtifactWrapper title={data.title || 'Diagram'} jsonData={data}>
      <div className="p-4 bg-white dark:bg-slate-900 overflow-x-auto flex justify-center">
        {error ? (
          <div className="text-xs text-red-500 dark:text-red-400 p-2">
            Diagram render error: {error}
          </div>
        ) : (
          <div ref={containerRef} className="mermaid-container [&_svg]:max-w-full" />
        )}
      </div>
    </ArtifactWrapper>
  )
}
