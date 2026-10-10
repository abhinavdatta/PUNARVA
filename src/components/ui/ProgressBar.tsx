import { cn } from '@/lib/utils'

export function ProgressBar({
  value,
  className,
  tone = 'copper',
  label,
}: {
  /** 0..1 */
  value: number
  className?: string
  tone?: 'copper' | 'teal'
  label?: string
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-plum-800 ring-1 ring-inset ring-plum-600/60', className)}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-300 ease-out',
          tone === 'copper'
            ? 'bg-gradient-to-r from-copper-600 to-copper-400 shadow-glowCopper'
            : 'bg-gradient-to-r from-sea-600 to-sea-400 shadow-glowTeal',
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
