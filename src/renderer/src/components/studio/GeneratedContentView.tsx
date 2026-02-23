import { useState } from 'react'
import type { GeneratedContent } from '@shared/types'
import { Button } from '../common/Button'
import { Maximize2 } from 'lucide-react'
import { ImageSlidesView } from './ImageSlidesView'
import {
  ReportView,
  QuizView,
  FlashcardView,
  MindMapView,
  DataTableView,
  SlidesView,
  AudioOverviewView,
  InfographicView,
  DashboardView,
  LiteratureReviewView,
  CompetitiveAnalysisView,
  DiffView,
  CitationGraphView,
  WhitePaperView,
} from './viewers'

interface GeneratedContentViewProps {
  content: GeneratedContent
  onBack: () => void
}

export function GeneratedContentView({ content, onBack }: GeneratedContentViewProps) {
  const rawData = content.data
  const data = (typeof rawData === 'string' ? JSON.parse(rawData) : rawData) as Record<string, unknown>
  const [copied, setCopied] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const handleCopy = async () => {
    let text: string
    if (content.type === 'report') {
      const markdown = data.markdown as string | undefined
      if (markdown) {
        text = markdown
      } else {
        const summary = (data.summary as string) || ''
        const sections = (data.sections as { title: string; content: string }[]) || []
        text = summary + '\n\n' + sections.map((s) => `## ${s.title}\n${s.content}`).join('\n\n')
      }
    } else if (content.type === 'whitepaper') {
      const wpTitle = (data.title as string) || ''
      const abstract = (data.abstract as string) || ''
      const wpSections = (data.sections as { number: string; title: string; content: string }[]) || []
      const conclusion = (data.conclusion as string) || ''
      const refs = (data.references as { number: number; citation: string }[]) || []
      text = `# ${wpTitle}\n\n## Abstract\n${abstract}\n\n` +
        wpSections.map((s) => `## ${s.number}. ${s.title}\n${s.content}`).join('\n\n') +
        `\n\n## Conclusion\n${conclusion}` +
        (refs.length ? '\n\n## References\n' + refs.map((r) => `[${r.number}] ${r.citation}`).join('\n') : '')
    } else {
      text = JSON.stringify(data, null, 2)
    }
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // image-slides has its own fullscreen — skip the Maximize button
  const showFullscreenButton = content.type !== 'image-slides'

  const viewerProps = {
    data,
    isFullscreen,
    onCloseFullscreen: () => setIsFullscreen(false),
    title: content.title,
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          &larr; Back
        </Button>
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 flex-1">{content.title}</h3>
        {showFullscreenButton && (
          <button
            onClick={() => setIsFullscreen(true)}
            className="px-2 py-1 rounded-lg text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
            title="Fullscreen"
          >
            <Maximize2 size={14} />
          </button>
        )}
        <button
          onClick={handleCopy}
          className="px-3 py-1 text-xs rounded-lg text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {content.type === 'report' && <ReportView {...viewerProps} />}
      {content.type === 'quiz' && <QuizView {...viewerProps} />}
      {content.type === 'flashcard' && <FlashcardView {...viewerProps} />}
      {content.type === 'mindmap' && <MindMapView {...viewerProps} />}
      {content.type === 'datatable' && <DataTableView {...viewerProps} />}
      {content.type === 'slides' && <SlidesView {...viewerProps} />}
      {content.type === 'image-slides' && <ImageSlidesView data={data} contentId={content.id} />}
      {content.type === 'audio' && <AudioOverviewView {...viewerProps} />}
      {content.type === 'infographic' && <InfographicView {...viewerProps} />}
      {content.type === 'dashboard' && <DashboardView {...viewerProps} />}
      {content.type === 'literature-review' && <LiteratureReviewView {...viewerProps} />}
      {content.type === 'competitive-analysis' && <CompetitiveAnalysisView {...viewerProps} />}
      {content.type === 'diff' && <DiffView {...viewerProps} />}
      {content.type === 'citation-graph' && <CitationGraphView {...viewerProps} />}
      {content.type === 'whitepaper' && <WhitePaperView {...viewerProps} />}

      {data.raw != null && (
        <pre className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-pre-wrap bg-black/[0.02] dark:bg-white/[0.02] rounded-lg p-4 border border-black/[0.06] dark:border-white/[0.06]">
          {String(data.raw)}
        </pre>
      )}
    </div>
  )
}
