import { useEffect, useCallback, useRef, useState } from 'react'
import { Save, X, FileCode, FileText, Circle, Lock, Sparkles, Loader2, Send } from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useNotebookStore } from '../../stores/notebookStore'
import { useAppStore } from '../../stores/appStore'

function getHeaderIcon(path: string) {
  const ext = path.includes('.') ? '.' + path.split('.').pop()!.toLowerCase() : ''
  if (ext === '.md' || ext === '.markdown') return FileText
  return FileCode
}

interface AiPopupState {
  visible: boolean
  selectionStart: number
  selectionEnd: number
  selectedText: string
  instruction: string
  loading: boolean
  top: number
  left: number
}

const initialPopupState: AiPopupState = {
  visible: false,
  selectionStart: 0,
  selectionEnd: 0,
  selectedText: '',
  instruction: '',
  loading: false,
  top: 0,
  left: 0,
}

export function FileEditor() {
  const { editorTab, setEditorContent, markEditorClean, closeEditor } = useWorkspaceStore()
  const currentNotebook = useNotebookStore((s) => s.currentNotebook)
  const { setActiveView } = useAppStore()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const popupInputRef = useRef<HTMLInputElement>(null)
  const [aiPopup, setAiPopup] = useState<AiPopupState>(initialPopupState)

  const handleSave = useCallback(async () => {
    if (!editorTab || !currentNotebook || !editorTab.isDirty || editorTab.isReadOnly) return

    try {
      await window.api.workspaceWrite({
        notebookId: currentNotebook.id,
        relativePath: editorTab.relativePath,
        content: editorTab.content,
      })
      markEditorClean()

      // Refresh tree to reflect potential stale status
      const tree = await window.api.workspaceScan(currentNotebook.id)
      useWorkspaceStore.getState().setTree(tree as never)
    } catch (err) {
      console.error('Failed to save file:', err)
    }
  }, [editorTab, currentNotebook, markEditorClean])

  // Cmd/Ctrl+S to save, Cmd/Ctrl+K for AI rewrite
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        openAiPopup()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSave])

  // Close popup when clicking outside
  useEffect(() => {
    if (!aiPopup.visible) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-ai-popup]')) {
        setAiPopup(initialPopupState)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [aiPopup.visible])

  const openAiPopup = () => {
    const ta = textareaRef.current
    const container = containerRef.current
    if (!ta || !container || !editorTab || editorTab.isReadOnly) return

    const start = ta.selectionStart
    const end = ta.selectionEnd
    if (start === end) return // No selection

    const selectedText = editorTab.content.slice(start, end)
    if (!selectedText.trim()) return

    // Calculate popup position relative to the container
    // We approximate based on character position
    const textBefore = editorTab.content.slice(0, start)
    const lines = textBefore.split('\n')
    const lineNumber = lines.length
    const lineHeight = 24 // matches leading-6
    const paddingTop = 16 // p-4

    const containerRect = container.getBoundingClientRect()
    const taRect = ta.getBoundingClientRect()

    // Position popup near the selection
    const scrollTop = ta.scrollTop
    const top = Math.min(
      (lineNumber * lineHeight) + paddingTop - scrollTop + taRect.top - containerRect.top + lineHeight,
      containerRect.height - 120
    )
    const left = Math.min(60, containerRect.width - 360)

    setAiPopup({
      visible: true,
      selectionStart: start,
      selectionEnd: end,
      selectedText,
      instruction: '',
      loading: false,
      top: Math.max(top, 40),
      left: Math.max(left, 16),
    })

    // Focus the input after render
    setTimeout(() => popupInputRef.current?.focus(), 50)
  }

  const handleAiRewrite = async () => {
    if (!aiPopup.instruction.trim() || aiPopup.loading || !editorTab) return

    setAiPopup((s) => ({ ...s, loading: true }))

    try {
      const result = await window.api.editorAiRewrite({
        selectedText: aiPopup.selectedText,
        instruction: aiPopup.instruction,
        fullContent: editorTab.content,
        filePath: editorTab.relativePath,
      })

      const { rewrittenText } = result as { rewrittenText: string }

      // Replace the selected text in the content
      const before = editorTab.content.slice(0, aiPopup.selectionStart)
      const after = editorTab.content.slice(aiPopup.selectionEnd)
      const newContent = before + rewrittenText + after
      setEditorContent(newContent)

      setAiPopup(initialPopupState)

      // Restore cursor after the replaced text
      setTimeout(() => {
        if (textareaRef.current) {
          const newEnd = aiPopup.selectionStart + rewrittenText.length
          textareaRef.current.selectionStart = aiPopup.selectionStart
          textareaRef.current.selectionEnd = newEnd
          textareaRef.current.focus()
        }
      }, 50)
    } catch (err) {
      console.error('AI rewrite failed:', err)
      setAiPopup((s) => ({ ...s, loading: false }))
    }
  }

  // Show AI button when text is selected (on mouse up)
  const handleMouseUp = () => {
    if (!textareaRef.current || !editorTab || editorTab.isReadOnly) return
    const ta = textareaRef.current
    if (ta.selectionStart !== ta.selectionEnd) {
      // Text is selected — don't auto-show popup, just let Cmd+K work
      // But we could show a subtle hint
    }
  }

  const handleClose = () => {
    if (editorTab?.isDirty && !editorTab.isReadOnly) {
      const ok = window.confirm('You have unsaved changes. Close anyway?')
      if (!ok) return
    }
    closeEditor()
    setActiveView('chat')
  }

  if (!editorTab) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500 bg-black/[0.02] dark:bg-white/[0.01]">
        <FileCode className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm">Click a file in the tree to view or edit it</p>
        <p className="text-xs mt-1 opacity-60">Text files are editable, others are read-only</p>
      </div>
    )
  }

  const fileName = editorTab.relativePath.split('/').pop() || editorTab.relativePath
  const Icon = getHeaderIcon(editorTab.relativePath)

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-zinc-900 min-h-0">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-black/[0.06] dark:border-white/[0.04] bg-black/[0.02] dark:bg-zinc-900 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="w-4 h-4 text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
          <span className="text-sm text-zinc-600 dark:text-zinc-300 truncate" title={editorTab.relativePath}>
            {editorTab.relativePath}
          </span>
          {editorTab.isDirty && !editorTab.isReadOnly && (
            <Circle className="w-2.5 h-2.5 fill-amber-500 text-amber-500 flex-shrink-0" />
          )}
          {editorTab.isReadOnly && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/[0.03] dark:bg-white/[0.03] text-zinc-400 dark:text-zinc-500 text-[10px] font-medium flex-shrink-0">
              <Lock className="w-2.5 h-2.5" />
              Read-only
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!editorTab.isReadOnly && (
            <>
              <button
                onClick={openAiPopup}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-500/15"
                title="AI Rewrite (select text first, or Cmd+K)"
              >
                <Sparkles className="w-3.5 h-3.5" />
                AI Edit
              </button>
              <button
                onClick={handleSave}
                disabled={!editorTab.isDirty}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/15"
              >
                <Save className="w-3.5 h-3.5" />
                Save
              </button>
            </>
          )}
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
            title="Close editor"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Editor area */}
      <div ref={containerRef} className="flex-1 min-h-0 relative">
        <textarea
          ref={textareaRef}
          value={editorTab.content}
          onChange={(e) => {
            if (!editorTab.isReadOnly) {
              setEditorContent(e.target.value)
            }
          }}
          onMouseUp={handleMouseUp}
          readOnly={editorTab.isReadOnly}
          className={`absolute inset-0 p-4 text-sm leading-6 resize-none focus:outline-none border-none ${
            editorTab.isReadOnly
              ? 'bg-black/[0.02] dark:bg-white/[0.01] text-zinc-600 dark:text-zinc-400 cursor-default'
              : 'bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200'
          } font-mono overflow-auto`}
          spellCheck={false}
          placeholder={editorTab.isReadOnly ? `Viewing ${fileName}` : `Editing ${fileName}...`}
        />

        {/* AI Rewrite popup */}
        {aiPopup.visible && (
          <div
            data-ai-popup
            className="absolute z-50 w-[340px] bg-white dark:bg-zinc-800 border border-black/[0.06] dark:border-white/[0.06] rounded-xl shadow-2xl shadow-zinc-200/50 dark:shadow-zinc-900/50 overflow-hidden"
            style={{ top: aiPopup.top, left: aiPopup.left }}
          >
            <div className="px-3 py-2 bg-violet-50 dark:bg-violet-500/10 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-violet-500" />
              <span className="text-xs font-medium text-violet-700 dark:text-violet-300">AI Edit</span>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 ml-auto">
                {aiPopup.selectedText.length} chars selected
              </span>
            </div>
            <div className="p-2">
              <div className="max-h-16 overflow-auto px-2 py-1.5 mb-2 bg-black/[0.02] dark:bg-zinc-900 rounded-lg text-xs text-zinc-500 dark:text-zinc-400 font-mono leading-relaxed">
                {aiPopup.selectedText.length > 150
                  ? aiPopup.selectedText.slice(0, 150) + '...'
                  : aiPopup.selectedText}
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  ref={popupInputRef}
                  type="text"
                  value={aiPopup.instruction}
                  onChange={(e) => setAiPopup((s) => ({ ...s, instruction: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleAiRewrite()
                    }
                    if (e.key === 'Escape') {
                      setAiPopup(initialPopupState)
                    }
                  }}
                  placeholder="e.g. Make it more concise..."
                  disabled={aiPopup.loading}
                  className="flex-1 px-3 py-2 text-sm bg-black/[0.02] dark:bg-zinc-900 border border-black/[0.06] dark:border-white/[0.06] rounded-lg text-zinc-700 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 dark:focus:border-violet-500/50"
                />
                <button
                  onClick={handleAiRewrite}
                  disabled={!aiPopup.instruction.trim() || aiPopup.loading}
                  className="p-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                >
                  {aiPopup.loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer hint */}
      {!editorTab.isReadOnly && (
        <div className="px-4 py-1.5 border-t border-black/[0.04] dark:border-white/[0.04] bg-black/[0.02] dark:bg-zinc-900 flex-shrink-0">
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
            Select text + <kbd className="px-1 py-0.5 bg-black/[0.06] dark:bg-white/[0.06] rounded text-[9px] font-mono">Cmd+K</kbd> for AI edit
            &nbsp;&middot;&nbsp;
            <kbd className="px-1 py-0.5 bg-black/[0.06] dark:bg-white/[0.06] rounded text-[9px] font-mono">Cmd+S</kbd> to save
          </p>
        </div>
      )}
    </div>
  )
}
