import { useState, useRef, useEffect } from 'react'
import type { Editor } from '@tiptap/react'
import {
  Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3,
  List, ListOrdered, ListChecks, Quote, Minus, Undo2, Redo2,
  Link as LinkIcon, Image, Table, Highlighter, Superscript, Subscript,
  CodeSquare, Type, ChevronRight, MessageSquare, Palette
} from 'lucide-react'
import type { CalloutType } from './extensions/CalloutExtension'

interface NoteEditorToolbarProps {
  editor: Editor | null
}

function ToolbarButton({
  onClick,
  active = false,
  disabled = false,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
        active
          ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300'
          : 'text-zinc-500 dark:text-zinc-400 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] hover:text-zinc-700 dark:hover:text-zinc-200'
      } disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="w-px h-5 bg-black/[0.08] dark:bg-white/[0.08] mx-0.5" />
}

const CALLOUT_TYPES: { type: CalloutType; label: string; color: string }[] = [
  { type: 'note', label: 'Note', color: '#3b82f6' },
  { type: 'tip', label: 'Tip', color: '#22c55e' },
  { type: 'warning', label: 'Warning', color: '#f59e0b' },
  { type: 'important', label: 'Important', color: '#ef4444' },
  { type: 'caution', label: 'Caution', color: '#a855f7' },
]

const TEXT_COLORS = [
  { label: 'Default', value: '' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Yellow', value: '#eab308' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'Pink', value: '#ec4899' },
  { label: 'Gray', value: '#6b7280' },
]

function CalloutDropdown({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <ToolbarButton
        onClick={() => setOpen(!open)}
        active={editor.isActive('callout')}
        title="Callout"
      >
        <MessageSquare size={14} />
      </ToolbarButton>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 rounded-lg shadow-lg py-1 z-50 w-36">
          {CALLOUT_TYPES.map((ct) => (
            <button
              key={ct.type}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left text-zinc-700 dark:text-zinc-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
              onClick={() => {
                editor.chain().focus().setCallout({ type: ct.type }).run()
                setOpen(false)
              }}
            >
              <span
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: ct.color }}
              />
              {ct.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ColorPickerButton({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <ToolbarButton onClick={() => setOpen(!open)} title="Text color">
        <Palette size={14} />
      </ToolbarButton>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 rounded-lg shadow-lg py-1 z-50 w-36">
          {TEXT_COLORS.map((c) => (
            <button
              key={c.label}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left text-zinc-700 dark:text-zinc-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
              onClick={() => {
                if (c.value) {
                  editor.chain().focus().setColor(c.value).run()
                } else {
                  editor.chain().focus().unsetColor().run()
                }
                setOpen(false)
              }}
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0 border border-black/10 dark:border-white/10"
                style={{ backgroundColor: c.value || 'currentColor' }}
              />
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function NoteEditorToolbar({ editor }: NoteEditorToolbarProps) {
  if (!editor) return null

  const addLink = () => {
    const url = window.prompt('Enter URL:')
    if (url) {
      editor.chain().focus().setLink({ href: url }).run()
    }
  }

  const addImage = () => {
    const url = window.prompt('Enter image URL:')
    if (url) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }

  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }

  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-black/[0.06] dark:border-white/[0.06] bg-black/[0.01] dark:bg-white/[0.01] overflow-x-auto flex-wrap">
      {/* Text style */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setParagraph().run()}
        active={editor.isActive('paragraph') && !editor.isActive('heading')}
        title="Paragraph"
      >
        <Type size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive('heading', { level: 1 })}
        title="Heading 1"
      >
        <Heading1 size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
        title="Heading 2"
      >
        <Heading2 size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive('heading', { level: 3 })}
        title="Heading 3"
      >
        <Heading3 size={14} />
      </ToolbarButton>

      <Divider />

      {/* Inline formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        title="Bold (Cmd+B)"
      >
        <Bold size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        title="Italic (Cmd+I)"
      >
        <Italic size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')}
        title="Strikethrough"
      >
        <Strikethrough size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive('code')}
        title="Inline code"
      >
        <Code size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        active={editor.isActive('highlight')}
        title="Highlight"
      >
        <Highlighter size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleSuperscript().run()}
        active={editor.isActive('superscript')}
        title="Superscript"
      >
        <Superscript size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleSubscript().run()}
        active={editor.isActive('subscript')}
        title="Subscript"
      >
        <Subscript size={14} />
      </ToolbarButton>

      <Divider />

      {/* Lists & blocks */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        title="Bullet list"
      >
        <List size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        title="Ordered list"
      >
        <ListOrdered size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        active={editor.isActive('taskList')}
        title="Task list"
      >
        <ListChecks size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
        title="Blockquote"
      >
        <Quote size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive('codeBlock')}
        title="Code block"
      >
        <CodeSquare size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Horizontal rule"
      >
        <Minus size={14} />
      </ToolbarButton>

      <Divider />

      {/* Insert */}
      <ToolbarButton onClick={addLink} active={editor.isActive('link')} title="Insert link">
        <LinkIcon size={14} />
      </ToolbarButton>
      <ToolbarButton onClick={addImage} title="Insert image">
        <Image size={14} />
      </ToolbarButton>
      <ToolbarButton onClick={insertTable} title="Insert table">
        <Table size={14} />
      </ToolbarButton>

      <Divider />

      {/* Callout, Toggle, Color */}
      <CalloutDropdown editor={editor} />
      <ToolbarButton
        onClick={() => editor.chain().focus().setDetails().run()}
        title="Toggle block"
      >
        <ChevronRight size={14} />
      </ToolbarButton>
      <ColorPickerButton editor={editor} />

      <Divider />

      {/* Undo/Redo */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo (Cmd+Z)"
      >
        <Undo2 size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo (Cmd+Shift+Z)"
      >
        <Redo2 size={14} />
      </ToolbarButton>
    </div>
  )
}
