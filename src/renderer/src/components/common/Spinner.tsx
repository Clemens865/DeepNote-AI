export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-10 h-10',
  }

  return (
    <div
      className={`${sizeClasses[size]} border-2 border-black/[0.06] dark:border-white/[0.06] border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin`}
    />
  )
}
