import { useEffect } from 'react'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

interface FullscreenWrapperProps {
  isOpen: boolean
  onClose: () => void
  title: string
  actions?: ReactNode
  children: ReactNode
  /** Use full width instead of max-w-4xl. Good for visual content like mindmaps/infographics. */
  wide?: boolean
}

export function FullscreenWrapper({ isOpen, onClose, title, actions, children, wide }: FullscreenWrapperProps) {
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-slate-900/80 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-white truncate">{title}</h3>
        <div className="flex items-center gap-2">
          {actions}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close fullscreen"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-6">
        <div className={wide ? 'w-full h-full' : 'max-w-4xl mx-auto'}>
          {children}
        </div>
      </div>
    </div>
  )
}
