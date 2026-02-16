import { useState } from 'react'
import { BookmarkPlus, Copy, Check, FileText, FolderPlus, Sparkles } from 'lucide-react'
import type { ChatMessage as ChatMessageType } from '@shared/types'
import { parseArtifacts } from '../../utils/artifactParser'
import { ChatArtifactTable } from './ChatArtifactTable'
import { ChatArtifactChart } from './ChatArtifactChart'
import { ChatArtifactMermaid } from './ChatArtifactMermaid'
import { ChatArtifactKanban } from './ChatArtifactKanban'
import { ChatArtifactKpi } from './ChatArtifactKpi'
import { ChatArtifactTimeline } from './ChatArtifactTimeline'

interface ChatMessageProps {
  message: ChatMessageType
  onSaveToNote?: (content: string) => void
  onSaveAsSource?: (content: string) => void
  onSaveToWorkspace?: (content: string) => void
  onGenerateFrom?: (content: string) => void
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function inlineFormat(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
    .replace(
      /`([^`]+)`/g,
      '<code class="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded text-[11px] font-mono">$1</code>'
    )
    .replace(
      /\[Source ([^\]]+)\]/g,
      '<span class="inline-flex items-center text-[10px] font-bold bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-full px-1.5 py-0.5 ml-0.5 align-middle">$1</span>'
    )
}

function renderMarkdown(text: string): string {
  // Step 1: Extract fenced code blocks (protect from other transforms)
  const codeBlocks: string[] = []
  let processed = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, _lang, code) => {
    const i = codeBlocks.length
    codeBlocks.push(
      `<pre class="bg-slate-900 dark:bg-slate-950 rounded-lg p-3 my-3 overflow-x-auto"><code class="text-xs font-mono text-slate-100 leading-relaxed">${escapeHtml(code.trim())}</code></pre>`
    )
    return `\x00CB${i}\x00`
  })

  // Step 2: Split into blocks by double newlines
  const blocks = processed.split(/\n{2,}/)

  const html = blocks
    .map((block) => {
      const trimmed = block.trim()
      if (!trimmed) return ''

      // Restore code block placeholders
      const cbMatch = trimmed.match(/^\x00CB(\d+)\x00$/)
      if (cbMatch) return codeBlocks[parseInt(cbMatch[1])] || ''

      // Headers
      const h3 = trimmed.match(/^### (.+)$/m)
      if (h3)
        return `<h4 class="text-sm font-bold text-slate-800 dark:text-slate-100 mt-4 mb-1">${inlineFormat(h3[1])}</h4>`

      const h2 = trimmed.match(/^## (.+)$/m)
      if (h2)
        return `<h3 class="text-[15px] font-bold text-slate-800 dark:text-slate-100 mt-4 mb-1">${inlineFormat(h2[1])}</h3>`

      const h1 = trimmed.match(/^# (.+)$/m)
      if (h1)
        return `<h2 class="text-base font-bold text-slate-800 dark:text-slate-100 mt-4 mb-2">${inlineFormat(h1[1])}</h2>`

      // Process multi-line blocks — detect lists
      const lines = trimmed.split('\n')
      const nonEmpty = lines.filter((l) => l.trim())

      const isUL = nonEmpty.length > 0 && nonEmpty.every((l) => /^\s*[-*•] /.test(l))
      const isOL = nonEmpty.length > 0 && nonEmpty.every((l) => /^\s*\d+\. /.test(l))

      if (isUL) {
        const items = nonEmpty.map((l) => {
          const content = l.replace(/^\s*[-*•] /, '')
          return `<li class="text-sm leading-relaxed">${inlineFormat(content)}</li>`
        })
        return `<ul class="list-disc pl-5 my-2 space-y-1">${items.join('')}</ul>`
      }

      if (isOL) {
        const items = nonEmpty.map((l) => {
          const content = l.replace(/^\s*\d+\. /, '')
          return `<li class="text-sm leading-relaxed">${inlineFormat(content)}</li>`
        })
        return `<ol class="list-decimal pl-5 my-2 space-y-1">${items.join('')}</ol>`
      }

      // Blockquote
      if (trimmed.startsWith('>')) {
        const content = trimmed.replace(/^>\s?/gm, '')
        return `<blockquote class="border-l-2 border-indigo-300 dark:border-indigo-500 pl-3 my-2 text-slate-600 dark:text-slate-400 italic text-sm">${inlineFormat(content)}</blockquote>`
      }

      // Mixed block: some lines are list items, some are not
      // Handle numbered headings like "1. **Title** Content" followed by bullet sub-items
      const hasNumberedHeading =
        nonEmpty.length > 0 && /^\d+\.\s+\*\*/.test(nonEmpty[0])
      const restAreBullets =
        nonEmpty.length > 1 && nonEmpty.slice(1).every((l) => /^\s*[-*•] /.test(l))

      if (hasNumberedHeading && restAreBullets) {
        const heading = nonEmpty[0].replace(/^\d+\.\s+/, '')
        const items = nonEmpty.slice(1).map((l) => {
          const content = l.replace(/^\s*[-*•] /, '')
          return `<li class="text-sm leading-relaxed">${inlineFormat(content)}</li>`
        })
        return `<div class="mt-3"><p class="text-sm font-semibold text-indigo-700 dark:text-indigo-400 mb-1">${inlineFormat(heading)}</p><ul class="list-disc pl-5 space-y-1">${items.join('')}</ul></div>`
      }

      // Default: paragraph
      const inner = trimmed.replace(/\n/g, '<br/>')
      return `<p class="my-1.5 text-sm leading-relaxed">${inlineFormat(inner)}</p>`
    })
    .join('')

  return html
}

export function ChatMessage({ message, onSaveToNote, onSaveAsSource, onSaveToWorkspace, onGenerateFrom }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savedSource, setSavedSource] = useState(false)
  const [savedWorkspace, setSavedWorkspace] = useState(false)

  const citations = Array.isArray(message.citations)
    ? message.citations
    : (() => {
        try {
          return JSON.parse(message.citations || '[]')
        } catch {
          return []
        }
      })()

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSaveToNote = () => {
    onSaveToNote?.(message.content)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleSaveAsSource = () => {
    onSaveAsSource?.(message.content)
    setSavedSource(true)
    setTimeout(() => setSavedSource(false), 2000)
  }

  const handleSaveToWorkspace = () => {
    onSaveToWorkspace?.(message.content)
    setSavedWorkspace(true)
    setTimeout(() => setSavedWorkspace(false), 2000)
  }

  const handleGenerateFrom = () => {
    onGenerateFrom?.(message.content)
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-md'
            : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm'
        }`}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
        ) : (
          <div className="chat-markdown">
            {parseArtifacts(message.content).map((seg, i) => {
              if (seg.type === 'artifact-table') {
                return <ChatArtifactTable key={i} data={seg.data} />
              }
              if (seg.type === 'artifact-chart') {
                return <ChatArtifactChart key={i} data={seg.data} />
              }
              if (seg.type === 'artifact-mermaid') {
                return <ChatArtifactMermaid key={i} data={seg.data} />
              }
              if (seg.type === 'artifact-kanban') {
                return <ChatArtifactKanban key={i} data={seg.data} />
              }
              if (seg.type === 'artifact-kpi') {
                return <ChatArtifactKpi key={i} data={seg.data} />
              }
              if (seg.type === 'artifact-timeline') {
                return <ChatArtifactTimeline key={i} data={seg.data} />
              }
              return (
                <div
                  key={i}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(seg.content) }}
                />
              )
            })}
          </div>
        )}

        {/* Citations */}
        {citations.length > 0 && (
          <div
            className={`mt-3 pt-3 flex flex-wrap gap-1.5 ${isUser ? 'border-t border-white/20' : 'border-t border-slate-200 dark:border-slate-700'}`}
          >
            {citations.map(
              (
                cit: { sourceTitle: string; chunkText?: string; pageNumber?: number },
                i: number
              ) => (
                <span
                  key={i}
                  className={`inline-block text-[9px] font-bold rounded px-2 py-0.5 uppercase tracking-tight ${
                    isUser
                      ? 'bg-white/15 text-white/80'
                      : 'bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600'
                  }`}
                  title={cit.chunkText}
                >
                  [{i + 1}] {cit.sourceTitle}
                  {cit.pageNumber ? ` p.${cit.pageNumber}` : ''}
                </span>
              )
            )}
          </div>
        )}

        {/* Action buttons for assistant messages */}
        {!isUser && message.content && (
          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
            {onSaveToNote && (
              <button
                onClick={handleSaveToNote}
                className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-md text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
              >
                {saved ? <Check size={12} /> : <BookmarkPlus size={12} />}
                {saved ? 'Saved!' : 'Note'}
              </button>
            )}
            {onSaveAsSource && (
              <button
                onClick={handleSaveAsSource}
                className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-md text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
              >
                {savedSource ? <Check size={12} /> : <FileText size={12} />}
                {savedSource ? 'Added!' : 'Source'}
              </button>
            )}
            {onSaveToWorkspace && (
              <button
                onClick={handleSaveToWorkspace}
                className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-md text-slate-400 dark:text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors"
              >
                {savedWorkspace ? <Check size={12} /> : <FolderPlus size={12} />}
                {savedWorkspace ? 'Saved!' : 'Workspace'}
              </button>
            )}
            {onGenerateFrom && (
              <button
                onClick={handleGenerateFrom}
                className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-md text-slate-400 dark:text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors"
              >
                <Sparkles size={12} />
                Generate
              </button>
            )}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-md text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
