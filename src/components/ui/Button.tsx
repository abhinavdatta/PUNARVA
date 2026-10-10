import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'teal'
type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-copper-400 to-copper-600 text-plum-950 font-semibold shadow-glowCopper hover:from-copper-300 hover:to-copper-500 border border-copper-300/40',
  teal: 'bg-sea-400/15 text-sea-300 border border-sea-400/40 hover:bg-sea-400/25 hover:text-sea-200',
  secondary:
    'bg-plum-800/80 text-ivory border border-plum-500/70 hover:bg-plum-700 hover:border-plum-400/70',
  ghost: 'text-lavender hover:text-ivory hover:bg-plum-700/60 border border-transparent',
  danger:
    'bg-critical-500/15 text-critical-400 border border-critical-500/50 hover:bg-critical-500/25 hover:text-critical-400',
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2.5',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'secondary', size = 'md', loading = false, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-lg transition-colors duration-150 select-none',
        'disabled:opacity-45 disabled:pointer-events-none',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-400',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
})
