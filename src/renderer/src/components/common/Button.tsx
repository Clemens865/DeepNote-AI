import { type ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center rounded-xl font-medium transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none'

  const variants = {
    primary: 'bg-indigo-600 dark:bg-indigo-500 text-white hover:bg-indigo-700 dark:hover:bg-indigo-400',
    secondary: 'bg-black/[0.03] dark:bg-white/[0.03] text-zinc-700 dark:text-zinc-200 border border-black/[0.06] dark:border-white/[0.06] hover:bg-black/[0.06] dark:hover:bg-white/[0.06]',
    ghost: 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.05]',
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  }

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
