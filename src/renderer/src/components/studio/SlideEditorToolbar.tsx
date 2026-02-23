import { useState } from 'react'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  Plus,
  Trash2,
  Palette,
} from 'lucide-react'
import type { Editor } from '@tiptap/react'

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 48]

const COLOR_PALETTE = [
  '#18181b', '#f1f5f9', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
]

interface SlideEditorToolbarProps {
  editor: Editor | null
  onAddElement: () => void
  onDeleteElement: () => void
  canDelete: boolean
}

export function SlideEditorToolbar({
  editor,
  onAddElement,
  onDeleteElement,
  canDelete,
}: SlideEditorToolbarProps) {
  const [showColors, setShowColors] = useState(false)

  if (!editor) return null

  const btn = (
    active: boolean,
    onClick: () => void,
    children: React.ReactNode,
    title: string
  ) => (
    <button
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClick()
      }}
      className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
        active
          ? 'bg-indigo-500 text-white'
          : 'text-zinc-300 hover:bg-zinc-700 hover:text-white'
      }`}
      title={title}
    >
      {children}
    </button>
  )

  return (
    <div
      className="flex items-center gap-0.5 bg-zinc-800 rounded-lg px-2 py-1 shadow-xl border border-zinc-700"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Format group */}
      {btn(editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), <Bold size={14} />, 'Bold')}
      {btn(editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), <Italic size={14} />, 'Italic')}
      {btn(editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), <UnderlineIcon size={14} />, 'Underline')}
      {btn(editor.isActive('strike'), () => editor.chain().focus().toggleStrike().run(), <Strikethrough size={14} />, 'Strikethrough')}

      <div className="w-px h-5 bg-zinc-600 mx-1" />

      {/* List */}
      {btn(editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), <List size={14} />, 'Bullet list')}

      <div className="w-px h-5 bg-zinc-600 mx-1" />

      {/* Alignment */}
      {btn(editor.isActive({ textAlign: 'left' }), () => editor.chain().focus().setTextAlign('left').run(), <AlignLeft size={14} />, 'Align left')}
      {btn(editor.isActive({ textAlign: 'center' }), () => editor.chain().focus().setTextAlign('center').run(), <AlignCenter size={14} />, 'Align center')}
      {btn(editor.isActive({ textAlign: 'right' }), () => editor.chain().focus().setTextAlign('right').run(), <AlignRight size={14} />, 'Align right')}

      <div className="w-px h-5 bg-zinc-600 mx-1" />

      {/* Font size */}
      <select
        className="h-7 bg-zinc-700 text-zinc-200 text-xs rounded px-1 border-none outline-none cursor-pointer"
        value=""
        onChange={(e) => {
          const size = e.target.value
          if (size) {
            editor.chain().focus().setMark('textStyle', { fontSize: `${size}px` }).run()
          }
        }}
        title="Font size"
      >
        <option value="" disabled>
          Size
        </option>
        {FONT_SIZES.map((s) => (
          <option key={s} value={s}>
            {s}px
          </option>
        ))}
      </select>

      <div className="w-px h-5 bg-zinc-600 mx-1" />

      {/* Color */}
      <div className="relative">
        {btn(false, () => setShowColors(!showColors), <Palette size={14} />, 'Text color')}
        {showColors && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 p-1.5 bg-zinc-800 rounded-lg border border-zinc-700 shadow-xl grid grid-cols-5 gap-1 z-50">
            {COLOR_PALETTE.map((color) => (
              <button
                key={color}
                className="w-5 h-5 rounded-full border border-zinc-600 hover:scale-110 transition-transform"
                style={{ backgroundColor: color }}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  editor.chain().focus().setColor(color).run()
                  setShowColors(false)
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Link */}
      {btn(editor.isActive('link'), () => {
        if (editor.isActive('link')) {
          editor.chain().focus().unsetLink().run()
        } else {
          const url = window.prompt('Enter URL:')
          if (url) {
            editor.chain().focus().setLink({ href: url }).run()
          }
        }
      }, <LinkIcon size={14} />, 'Link')}

      <div className="w-px h-5 bg-zinc-600 mx-1" />

      {/* Add text box */}
      {btn(false, onAddElement, <Plus size={14} />, 'Add text box')}

      {/* Delete element */}
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onDeleteElement()
        }}
        disabled={!canDelete}
        className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
          canDelete
            ? 'text-red-400 hover:bg-red-500/20 hover:text-red-300'
            : 'text-zinc-600 cursor-not-allowed'
        }`}
        title="Delete element"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}
