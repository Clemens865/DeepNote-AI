import { useState, useEffect } from 'react'
import { X, FileText, Globe, Notebook } from 'lucide-react'
import type { NoteTemplate } from '@shared/types'

interface TemplatePickerProps {
  open: boolean
  onClose: () => void
  onSelectTemplate: (template: NoteTemplate) => void
  notebookId?: string
}

export function TemplatePicker({ open, onClose, onSelectTemplate, notebookId }: TemplatePickerProps) {
  const [templates, setTemplates] = useState<NoteTemplate[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    window.api
      .noteTemplatesList({ notebookId })
      .then((result: NoteTemplate[]) => setTemplates(result))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [open, notebookId])

  if (!open) return null

  const handleSelect = (template: NoteTemplate) => {
    const today = new Date().toISOString().split('T')[0]
    const processed = {
      ...template,
      content: template.content
        .replace(/\{\{date\}\}/g, today)
        .replace(/\{\{title\}\}/g, 'Untitled'),
    }
    onSelectTemplate(processed)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden border border-black/[0.08] dark:border-white/[0.08]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">New from Template</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Template grid */}
        <div className="p-4 max-h-80 overflow-auto">
          {loading ? (
            <div className="text-center py-8 text-xs text-zinc-400 dark:text-zinc-500">Loading templates...</div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-xs text-zinc-400 dark:text-zinc-500">No templates available.</div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleSelect(template)}
                  className="flex flex-col items-start gap-2 p-4 rounded-xl border border-black/[0.06] dark:border-white/[0.06] hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/[0.04] transition-all text-left group"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {template.title}
                    </span>
                  </div>
                  {template.description && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                      {template.description}
                    </p>
                  )}
                  <div className="flex items-center gap-1 mt-auto">
                    {template.isGlobal ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                        <Globe className="w-2.5 h-2.5" />
                        Global
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center gap-0.5">
                        <Notebook className="w-2.5 h-2.5" />
                        Notebook
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
