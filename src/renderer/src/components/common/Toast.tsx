import { useEffect } from 'react'

interface ToastProps {
  message: string
  type?: 'info' | 'error' | 'success'
  onClose: () => void
  duration?: number
}

export function Toast({ message, type = 'info', onClose, duration = 4000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration)
    return () => clearTimeout(timer)
  }, [onClose, duration])

  const colors = {
    info: 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200',
    error: 'bg-red-500/10 border-red-500/20 text-red-400',
    success: 'bg-green-500/10 border-green-500/20 text-green-400',
  }

  return (
    <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 ${colors[type]} border px-6 py-3 rounded-xl shadow-xl text-sm z-50`}>
      {message}
    </div>
  )
}
