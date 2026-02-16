import { useState, useRef } from 'react'
import type { Notebook } from '@shared/types'
import { Modal } from '../common/Modal'
import { Button } from '../common/Button'
import { ImagePlus, X, RotateCcw } from 'lucide-react'

interface CardCustomizeModalProps {
  notebook: Notebook
  isOpen: boolean
  onClose: () => void
  onSave: () => void
}

const GRADIENT_PRESETS = [
  { from: '#6366f1', to: '#a855f7', label: 'Indigo → Purple' },
  { from: '#3b82f6', to: '#06b6d4', label: 'Blue → Cyan' },
  { from: '#f43f5e', to: '#f97316', label: 'Rose → Orange' },
  { from: '#10b981', to: '#14b8a6', label: 'Emerald → Teal' },
  { from: '#64748b', to: '#71717a', label: 'Slate → Zinc' },
  { from: '#f59e0b', to: '#ef4444', label: 'Amber → Red' },
  { from: '#8b5cf6', to: '#d946ef', label: 'Violet → Fuchsia' },
  { from: '#0ea5e9', to: '#6366f1', label: 'Sky → Indigo' },
]

export function CardCustomizeModal({ notebook, isOpen, onClose, onSave }: CardCustomizeModalProps) {
  const [gradientFrom, setGradientFrom] = useState(notebook.cardGradientFrom || '#6366f1')
  const [gradientTo, setGradientTo] = useState(notebook.cardGradientTo || '#a855f7')
  const [imagePreview, setImagePreview] = useState<string | null>(
    notebook.cardBgImage ? `local-file://${notebook.cardBgImage}` : null
  )
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setImagePreview(result)
      setImageBase64(result)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleRemoveImage = () => {
    setImagePreview(null)
    setImageBase64(null)
  }

  const handleApplyGradient = async () => {
    setSaving(true)
    try {
      // Clear image if setting gradient
      await window.api.updateNotebook(notebook.id, {
        cardBgImage: null,
        cardGradientFrom: gradientFrom,
        cardGradientTo: gradientTo,
      })
      onSave()
    } finally {
      setSaving(false)
    }
  }

  const handleApplyImage = async () => {
    if (!imageBase64) return
    setSaving(true)
    try {
      await window.api.uploadNotebookCover(notebook.id, imageBase64)
      // Clear gradient when setting image
      await window.api.updateNotebook(notebook.id, {
        cardGradientFrom: null,
        cardGradientTo: null,
      })
      onSave()
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    setSaving(true)
    try {
      await window.api.updateNotebook(notebook.id, {
        cardBgImage: null,
        cardGradientFrom: null,
        cardGradientTo: null,
      })
      setImagePreview(null)
      setImageBase64(null)
      onSave()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Customize card">
      <div className="space-y-5">
        {/* Image Section */}
        <div>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
            Background image
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
          {imagePreview ? (
            <div className="relative rounded-xl overflow-hidden h-28">
              <img
                src={imagePreview}
                alt="Cover preview"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/20" />
              <button
                onClick={handleRemoveImage}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-28 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500/50 flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
            >
              <ImagePlus className="w-6 h-6" />
              <span className="text-xs">Choose image</span>
            </button>
          )}
          {imageBase64 && (
            <Button
              onClick={handleApplyImage}
              disabled={saving}
              size="sm"
              className="mt-2 w-full"
            >
              {saving ? 'Saving...' : 'Apply image'}
            </Button>
          )}
        </div>

        {/* Gradient Section */}
        <div>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
            Gradient color
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {GRADIENT_PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => {
                  setGradientFrom(preset.from)
                  setGradientTo(preset.to)
                }}
                title={preset.label}
                className={`w-10 h-10 rounded-lg transition-all hover:scale-110 ${
                  gradientFrom === preset.from && gradientTo === preset.to
                    ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900'
                    : ''
                }`}
                style={{
                  background: `linear-gradient(135deg, ${preset.from}, ${preset.to})`,
                }}
              />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <input
                type="color"
                value={gradientFrom}
                onChange={(e) => setGradientFrom(e.target.value)}
                className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent"
              />
              <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">{gradientFrom}</span>
            </div>
            <span className="text-xs text-slate-400 dark:text-slate-500">→</span>
            <div className="flex items-center gap-2 flex-1">
              <input
                type="color"
                value={gradientTo}
                onChange={(e) => setGradientTo(e.target.value)}
                className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent"
              />
              <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">{gradientTo}</span>
            </div>
          </div>
          {/* Gradient preview */}
          <div
            className="mt-2 h-10 rounded-xl"
            style={{
              background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
            }}
          />
          <Button
            onClick={handleApplyGradient}
            disabled={saving}
            size="sm"
            className="mt-2 w-full"
          >
            {saving ? 'Saving...' : 'Apply gradient'}
          </Button>
        </div>

        {/* Reset */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button
            variant="ghost"
            onClick={handleReset}
            disabled={saving}
            size="sm"
            className="w-full"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-2" />
            Reset to default
          </Button>
        </div>
      </div>
    </Modal>
  )
}
