import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FullscreenWrapper } from './FullscreenWrapper'
import { ChevronDown, ChevronRight, BookOpen, Lightbulb, ListOrdered, Quote, Download, Loader2 } from 'lucide-react'

interface WhitePaperViewProps {
  data: Record<string, unknown>
  isFullscreen: boolean
  onCloseFullscreen: () => void
  title: string
}

interface Section {
  number: string
  title: string
  content: string
  imagePath?: string
  imageCaption?: string
}

interface Reference {
  number: number
  citation: string
}

const markdownComponents = {
  h1: ({ children, ...props }: React.ComponentPropsWithoutRef<'h1'>) => (
    <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 mt-6 mb-3" {...props}>{children}</h1>
  ),
  h2: ({ children, ...props }: React.ComponentPropsWithoutRef<'h2'>) => (
    <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 mt-5 mb-2" {...props}>{children}</h2>
  ),
  h3: ({ children, ...props }: React.ComponentPropsWithoutRef<'h3'>) => (
    <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-100 mt-4 mb-2" {...props}>{children}</h3>
  ),
  p: ({ children, ...props }: React.ComponentPropsWithoutRef<'p'>) => (
    <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed mb-3" {...props}>{children}</p>
  ),
  strong: ({ children, ...props }: React.ComponentPropsWithoutRef<'strong'>) => (
    <strong className="font-semibold text-zinc-800 dark:text-zinc-100" {...props}>{children}</strong>
  ),
  ul: ({ children, ...props }: React.ComponentPropsWithoutRef<'ul'>) => (
    <ul className="list-disc pl-5 space-y-1 mb-3" {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }: React.ComponentPropsWithoutRef<'ol'>) => (
    <ol className="list-decimal pl-5 space-y-1 mb-3" {...props}>{children}</ol>
  ),
  li: ({ children, ...props }: React.ComponentPropsWithoutRef<'li'>) => (
    <li className="text-sm text-zinc-600 dark:text-zinc-300" {...props}>{children}</li>
  ),
  table: ({ children, ...props }: React.ComponentPropsWithoutRef<'table'>) => (
    <div className="overflow-auto rounded-lg border border-black/[0.06] dark:border-white/[0.06] mb-3">
      <table className="w-full text-sm" {...props}>{children}</table>
    </div>
  ),
  thead: ({ children, ...props }: React.ComponentPropsWithoutRef<'thead'>) => (
    <thead className="bg-black/[0.02] dark:bg-white/[0.02]" {...props}>{children}</thead>
  ),
  th: ({ children, ...props }: React.ComponentPropsWithoutRef<'th'>) => (
    <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-600 dark:text-zinc-300 border-b border-black/[0.06] dark:border-white/[0.06]" {...props}>{children}</th>
  ),
  td: ({ children, ...props }: React.ComponentPropsWithoutRef<'td'>) => (
    <td className="px-3 py-2 text-zinc-700 dark:text-zinc-200 border-b border-black/[0.06] dark:border-white/[0.06]" {...props}>{children}</td>
  ),
  blockquote: ({ children, ...props }: React.ComponentPropsWithoutRef<'blockquote'>) => (
    <blockquote className="border-l-4 border-indigo-300 dark:border-indigo-600 pl-4 italic text-zinc-500 dark:text-zinc-400 my-3" {...props}>{children}</blockquote>
  ),
  code: ({ children, className, ...props }: React.ComponentPropsWithoutRef<'code'> & { className?: string }) => {
    if (className) {
      return (
        <pre className="bg-black/[0.02] dark:bg-white/[0.02] rounded-lg p-3 overflow-auto text-xs mb-3 border border-black/[0.06] dark:border-white/[0.06]">
          <code className={className} {...props}>{children}</code>
        </pre>
      )
    }
    return <code className="bg-black/[0.03] dark:bg-white/[0.03] px-1.5 py-0.5 rounded text-xs text-indigo-600 dark:text-indigo-400" {...props}>{children}</code>
  },
}

function WhitePaperContent({ data }: { data: Record<string, unknown> }) {
  const wpTitle = data.title as string | undefined
  const subtitle = data.subtitle as string | undefined
  const abstract = data.abstract as string | undefined
  const date = data.date as string | undefined
  const coverImagePath = data.coverImagePath as string | undefined
  const tableOfContents = (data.tableOfContents as { number: string; title: string }[]) || []
  const sections = (data.sections as Section[]) || []
  const references = (data.references as Reference[]) || []
  const keyFindings = (data.keyFindings as string[]) || []
  const conclusion = data.conclusion as string | undefined

  const [tocOpen, setTocOpen] = useState(true)

  return (
    <div className="space-y-6">
      {/* Cover / Title Block */}
      <div className="relative rounded-xl overflow-hidden">
        {coverImagePath && (
          <div className="relative h-48 overflow-hidden rounded-xl">
            <img
              src={`local-file://${coverImagePath}`}
              alt="Cover"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5">
              {wpTitle && <h1 className="text-xl font-bold text-white mb-1">{wpTitle}</h1>}
              {subtitle && <p className="text-sm text-white/80">{subtitle}</p>}
              {date && <p className="text-xs text-white/60 mt-2">{date}</p>}
            </div>
          </div>
        )}
        {!coverImagePath && wpTitle && (
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl p-6">
            <h1 className="text-xl font-bold text-white mb-1">{wpTitle}</h1>
            {subtitle && <p className="text-sm text-white/80">{subtitle}</p>}
            {date && <p className="text-xs text-white/60 mt-2">{date}</p>}
          </div>
        )}
      </div>

      {/* Abstract */}
      {abstract && (
        <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen size={14} className="text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wide">Abstract</h3>
          </div>
          <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{abstract}</p>
        </div>
      )}

      {/* Key Findings */}
      {keyFindings.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb size={14} className="text-amber-600 dark:text-amber-400" />
            <h3 className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide">Key Findings</h3>
          </div>
          <ul className="space-y-2">
            {keyFindings.map((finding, i) => (
              <li key={i} className="flex gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <span className="text-amber-500 font-bold flex-shrink-0">{i + 1}.</span>
                {finding}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Table of Contents */}
      {tableOfContents.length > 0 && (
        <div className="bg-black/[0.02] dark:bg-white/[0.02] rounded-xl border border-black/[0.06] dark:border-white/[0.06] overflow-hidden">
          <button
            onClick={() => setTocOpen(!tocOpen)}
            className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
          >
            <ListOrdered size={14} className="text-zinc-500 dark:text-zinc-400" />
            <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wide flex-1">Table of Contents</span>
            {tocOpen ? <ChevronDown size={14} className="text-zinc-400" /> : <ChevronRight size={14} className="text-zinc-400" />}
          </button>
          {tocOpen && (
            <div className="px-4 pb-3 space-y-1">
              {tableOfContents.map((entry, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-zinc-400 dark:text-zinc-500 font-mono text-xs w-6 text-right">{entry.number}.</span>
                  <span className="text-zinc-700 dark:text-zinc-300">{entry.title}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-zinc-400 dark:text-zinc-500 font-mono text-xs w-6 text-right" />
                <span className="text-zinc-500 dark:text-zinc-400 italic">Conclusion</span>
              </div>
              {references.length > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-zinc-400 dark:text-zinc-500 font-mono text-xs w-6 text-right" />
                  <span className="text-zinc-500 dark:text-zinc-400 italic">References</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sections */}
      {sections.map((section, i) => (
        <div key={i} className="space-y-3">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{section.number}.</span>
            <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">{section.title}</h2>
          </div>

          {/* Section image */}
          {section.imagePath && (
            <figure className="rounded-xl overflow-hidden border border-black/[0.06] dark:border-white/[0.06]">
              <img
                src={`local-file://${section.imagePath}`}
                alt={section.imageCaption || `Figure for section ${section.number}`}
                className="w-full"
              />
              {section.imageCaption && (
                <figcaption className="bg-black/[0.02] dark:bg-white/[0.02] px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400 italic">
                  {section.imageCaption}
                </figcaption>
              )}
            </figure>
          )}

          {/* Section content */}
          <div className="prose-container">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {section.content}
            </ReactMarkdown>
          </div>
        </div>
      ))}

      {/* Conclusion */}
      {conclusion && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">Conclusion</h2>
          <div className="prose-container">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {conclusion}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* References */}
      {references.length > 0 && (
        <div className="bg-black/[0.02] dark:bg-white/[0.02] rounded-xl border border-black/[0.06] dark:border-white/[0.06] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Quote size={14} className="text-zinc-500 dark:text-zinc-400" />
            <h3 className="text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wide">References</h3>
          </div>
          <ol className="space-y-2">
            {references.map((ref) => (
              <li key={ref.number} className="flex gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                <span className="text-zinc-400 dark:text-zinc-500 font-mono flex-shrink-0">[{ref.number}]</span>
                <span className="leading-relaxed">{ref.citation}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

export function WhitePaperView({ data, isFullscreen, onCloseFullscreen, title }: WhitePaperViewProps) {
  const [exporting, setExporting] = useState(false)

  const handleExportPdf = async () => {
    setExporting(true)
    try {
      const sections = ((data.sections as Section[]) || []).map((s) => ({
        number: s.number,
        title: s.title,
        content: s.content,
        imagePath: s.imagePath,
        imageCaption: s.imageCaption,
      }))
      const references = ((data.references as Reference[]) || []).map((r) => ({
        number: r.number,
        citation: r.citation,
      }))

      await window.api.whitepaperExportPdf({
        title: (data.title as string) || 'White Paper',
        subtitle: (data.subtitle as string) || '',
        abstract: (data.abstract as string) || '',
        date: (data.date as string) || '',
        sections,
        references,
        keyFindings: (data.keyFindings as string[]) || [],
        conclusion: (data.conclusion as string) || '',
        coverImagePath: (data.coverImagePath as string) || undefined,
        defaultName: `${((data.title as string) || 'White Paper').replace(/[^a-zA-Z0-9 ]/g, '').trim()}.pdf`,
      })
    } catch (err) {
      console.error('PDF export failed:', err)
    } finally {
      setExporting(false)
    }
  }

  const exportAction = (
    <button
      onClick={handleExportPdf}
      disabled={exporting}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-white transition-colors disabled:opacity-50"
      title="Export as PDF"
    >
      {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
      {exporting ? 'Exporting...' : 'Export PDF'}
    </button>
  )

  return (
    <>
      <div className="relative">
        <div className="absolute top-0 right-0 z-10">
          <button
            onClick={handleExportPdf}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50"
            title="Export as PDF"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {exporting ? 'Exporting...' : 'Export PDF'}
          </button>
        </div>
        <WhitePaperContent data={data} />
      </div>
      <FullscreenWrapper isOpen={isFullscreen} onClose={onCloseFullscreen} title={title} actions={exportAction}>
        <div className="bg-white rounded-xl p-6 shadow-lg max-w-4xl mx-auto">
          <WhitePaperContent data={data} />
        </div>
      </FullscreenWrapper>
    </>
  )
}
