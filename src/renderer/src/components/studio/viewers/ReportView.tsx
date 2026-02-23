import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FullscreenWrapper } from './FullscreenWrapper'

interface ReportViewProps {
  data: Record<string, unknown>
  isFullscreen: boolean
  onCloseFullscreen: () => void
  title: string
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
  a: ({ children, ...props }: React.ComponentPropsWithoutRef<'a'>) => (
    <a className="text-indigo-600 dark:text-indigo-400 underline" {...props}>{children}</a>
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

function ReportContent({ data }: { data: Record<string, unknown> }) {
  const summary = data.summary as string | undefined
  const markdown = data.markdown as string | undefined
  const sections = data.sections as { title: string; content: string }[] | undefined

  // New markdown format
  if (markdown) {
    return (
      <div className="space-y-4">
        {summary && (
          <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-lg p-4">
            <p className="text-sm text-zinc-800 dark:text-zinc-100">{summary}</p>
          </div>
        )}
        <div className="prose-container">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {markdown}
          </ReactMarkdown>
        </div>
      </div>
    )
  }

  // Legacy sections format (backward compatible)
  return (
    <div className="space-y-4">
      {summary && (
        <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-lg p-4">
          <p className="text-sm text-zinc-800 dark:text-zinc-100">{summary}</p>
        </div>
      )}
      {sections?.map((section, i) => (
        <div key={i} className="space-y-2">
          <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{section.title}</h4>
          <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">{section.content}</p>
        </div>
      ))}
    </div>
  )
}

export function ReportView({ data, isFullscreen, onCloseFullscreen, title }: ReportViewProps) {
  return (
    <>
      <ReportContent data={data} />
      <FullscreenWrapper isOpen={isFullscreen} onClose={onCloseFullscreen} title={title}>
        <ReportContent data={data} />
      </FullscreenWrapper>
    </>
  )
}
