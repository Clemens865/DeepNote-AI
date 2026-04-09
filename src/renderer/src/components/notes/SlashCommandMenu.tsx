import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import type { Editor } from '@tiptap/react'
import {
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  ChevronRight,
  MessageSquare,
  Quote,
  CodeSquare,
  Minus,
  Table,
  ImageIcon,
} from 'lucide-react'
import { getSlashCommandState, closeSlashCommand } from './extensions/SlashCommandExtension'

interface SlashMenuItem {
  label: string
  description: string
  icon: React.ReactNode
  action: (editor: Editor) => void
}

function buildMenuItems(): SlashMenuItem[] {
  return [
    {
      label: 'Text',
      description: 'Plain paragraph',
      icon: <Type size={16} />,
      action: (editor) => editor.chain().focus().setParagraph().run(),
    },
    {
      label: 'Heading 1',
      description: 'Large heading',
      icon: <Heading1 size={16} />,
      action: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      label: 'Heading 2',
      description: 'Medium heading',
      icon: <Heading2 size={16} />,
      action: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: 'Heading 3',
      description: 'Small heading',
      icon: <Heading3 size={16} />,
      action: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      label: 'Bullet List',
      description: 'Unordered list',
      icon: <List size={16} />,
      action: (editor) => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: 'Numbered List',
      description: 'Ordered list',
      icon: <ListOrdered size={16} />,
      action: (editor) => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      label: 'Task List',
      description: 'Checkboxes',
      icon: <ListChecks size={16} />,
      action: (editor) => editor.chain().focus().toggleTaskList().run(),
    },
    {
      label: 'Toggle',
      description: 'Collapsible section',
      icon: <ChevronRight size={16} />,
      action: (editor) => editor.chain().focus().setDetails().run(),
    },
    {
      label: 'Callout',
      description: 'Highlighted box',
      icon: <MessageSquare size={16} />,
      action: (editor) => editor.chain().focus().setCallout({ type: 'note' }).run(),
    },
    {
      label: 'Quote',
      description: 'Blockquote',
      icon: <Quote size={16} />,
      action: (editor) => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      label: 'Code Block',
      description: 'Code with syntax highlighting',
      icon: <CodeSquare size={16} />,
      action: (editor) => editor.chain().focus().toggleCodeBlock().run(),
    },
    {
      label: 'Divider',
      description: 'Horizontal rule',
      icon: <Minus size={16} />,
      action: (editor) => editor.chain().focus().setHorizontalRule().run(),
    },
    {
      label: 'Table',
      description: 'Insert 3x3 table',
      icon: <Table size={16} />,
      action: (editor) =>
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    },
    {
      label: 'Image',
      description: 'Insert from URL',
      icon: <ImageIcon size={16} />,
      action: (editor) => {
        const url = window.prompt('Enter image URL:')
        if (url) {
          editor.chain().focus().setImage({ src: url }).run()
        }
      },
    },
  ]
}

interface SlashCommandMenuProps {
  editor: Editor
}

export function SlashCommandMenu({ editor }: SlashCommandMenuProps) {
  const [state, setState] = useState<{
    active: boolean
    query: string
    from: number
    to: number
    top: number
    left: number
  } | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)
  const items = useMemo(() => buildMenuItems(), [])

  const filteredItems = useMemo(() => {
    if (!state?.query) return items
    const q = state.query.toLowerCase()
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)
    )
  }, [items, state?.query])

  // Poll for slash command state from the ProseMirror plugin
  useEffect(() => {
    const interval = setInterval(() => {
      const slashState = getSlashCommandState(editor)
      if (slashState) {
        setState(slashState)
      } else {
        setState(null)
        setSelectedIndex(0)
      }
    }, 50)
    return () => clearInterval(interval)
  }, [editor])

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [state?.query])

  const executeItem = useCallback(
    (item: SlashMenuItem) => {
      if (!state) return
      // Delete the slash and query text
      editor
        .chain()
        .focus()
        .deleteRange({ from: state.from - 1, to: state.to })
        .run()
      closeSlashCommand(editor)
      // Execute the command
      item.action(editor)
    },
    [editor, state]
  )

  // Listen for keyboard events forwarded from the ProseMirror plugin
  useEffect(() => {
    const handler = (e: Event) => {
      const key = (e as CustomEvent).detail?.key
      if (key === 'ArrowDown') {
        setSelectedIndex((prev) => (prev + 1) % Math.max(filteredItems.length, 1))
      } else if (key === 'ArrowUp') {
        setSelectedIndex(
          (prev) => (prev - 1 + Math.max(filteredItems.length, 1)) % Math.max(filteredItems.length, 1)
        )
      } else if (key === 'Enter') {
        if (filteredItems[selectedIndex]) {
          executeItem(filteredItems[selectedIndex])
        }
      }
    }
    window.addEventListener('slash-command-keydown', handler)
    return () => window.removeEventListener('slash-command-keydown', handler)
  }, [filteredItems, selectedIndex, executeItem])

  // Scroll selected item into view
  useEffect(() => {
    if (!menuRef.current) return
    const selected = menuRef.current.querySelector('[data-selected="true"]')
    selected?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (!state?.active || filteredItems.length === 0) return null

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[9999] bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 rounded-lg shadow-lg py-1 w-64 max-h-72 overflow-y-auto"
      style={{ top: state.top + 4, left: state.left }}
    >
      {filteredItems.map((item, index) => (
        <button
          key={item.label}
          data-selected={index === selectedIndex}
          className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
            index === selectedIndex
              ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300'
              : 'text-zinc-700 dark:text-zinc-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
          }`}
          onMouseEnter={() => setSelectedIndex(index)}
          onMouseDown={(e) => {
            e.preventDefault() // prevent editor blur
            executeItem(item)
          }}
        >
          <span className="flex-shrink-0 text-zinc-400 dark:text-zinc-500">{item.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="font-medium">{item.label}</div>
            <div className="text-xs text-zinc-400 dark:text-zinc-500 truncate">
              {item.description}
            </div>
          </div>
        </button>
      ))}
    </div>,
    document.body
  )
}
