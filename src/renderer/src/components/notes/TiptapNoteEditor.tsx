import { useEffect, useRef, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import Image from '@tiptap/extension-image'
import Typography from '@tiptap/extension-typography'
import Superscript from '@tiptap/extension-superscript'
import Subscript from '@tiptap/extension-subscript'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import { NoteEditorToolbar } from './NoteEditorToolbar'

const lowlight = createLowlight(common)

interface TiptapNoteEditorProps {
  content: string
  onContentChange: (html: string) => void
  onNavigateToNote?: (noteTitle: string) => void
}

/** Convert plain text to simple HTML paragraphs for backward compatibility */
function plainTextToHtml(text: string): string {
  if (!text) return ''
  // Already HTML
  if (text.trimStart().startsWith('<')) return text
  // Convert plain text lines to paragraphs
  return text
    .split('\n')
    .map((line) => `<p>${line || '<br>'}</p>`)
    .join('')
}

export function TiptapNoteEditor({ content, onContentChange, onNavigateToNote }: TiptapNoteEditorProps) {
  const isExternalUpdate = useRef(false)
  const htmlContent = plainTextToHtml(content)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // replaced by CodeBlockLowlight
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-indigo-600 dark:text-indigo-400 underline decoration-indigo-300 dark:decoration-indigo-600 underline-offset-2 cursor-pointer',
        },
      }),
      Placeholder.configure({
        placeholder: 'Start writing... Use #tags and [[Note Title]] for links',
      }),
      Highlight.configure({
        multicolor: true,
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableCell,
      TableHeader,
      Image.configure({
        inline: true,
      }),
      Typography,
      Superscript,
      Subscript,
      CodeBlockLowlight.configure({
        lowlight,
      }),
    ],
    content: htmlContent || '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[200px] px-6 py-4',
      },
      handleClick: (_view, _pos, event) => {
        // Handle [[wiki link]] clicks
        const target = event.target as HTMLElement
        if (target.classList.contains('wiki-link')) {
          const noteTitle = target.getAttribute('data-note-title')
          if (noteTitle && onNavigateToNote) {
            onNavigateToNote(noteTitle)
          }
          return true
        }
        return false
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (isExternalUpdate.current) return
      onContentChange(ed.getHTML())
    },
  })

  // Track the note identity to detect note switches
  const lastContentRef = useRef(content)

  // Sync external content changes (e.g. switching notes)
  useEffect(() => {
    if (!editor) return
    // Only reset editor content when the note itself changes (not from our own edits)
    if (content !== lastContentRef.current) {
      lastContentRef.current = content
      isExternalUpdate.current = true
      editor.commands.setContent(plainTextToHtml(content) || '')
      isExternalUpdate.current = false
    }
  }, [content, editor])

  // Handle wiki link rendering via decorations
  const handleEditorClick = useCallback(
    (event: React.MouseEvent) => {
      const target = event.target as HTMLElement
      if (target.dataset.wikiLink && onNavigateToNote) {
        onNavigateToNote(target.dataset.wikiLink)
      }
    },
    [onNavigateToNote]
  )

  return (
    <div className="flex flex-col h-full" onClick={handleEditorClick}>
      <NoteEditorToolbar editor={editor} />
      <div className="flex-1 overflow-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
