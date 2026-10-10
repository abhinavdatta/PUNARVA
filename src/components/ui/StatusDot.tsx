import { cn } from '@/lib/utils'

export type DotTone = 'teal' | 'copper' | 'amber' | 'red' | 'grey'

const tones: Record<DotTone, string> = {
  teal: 'bg-sea-400 shadow-[0_0_8px_1px_rgba(99,216,194,0.7)]',
  copper: 'bg-copper-500 shadow-[0_0_8px_1px_rgba(255,147,107,0.7)]',
  amber: 'bg-amber-400 shadow-[0_0_8px_1px_rgba(245,184,76,0.7)]',
  red: 'bg-critical-500 shadow-[0_0_8px_1px_rgba(232,92,92,0.7)]',
  grey: 'bg-lavender/40',
}

export function StatusDot({ tone, pulse = false, className }: { tone: DotTone; pulse?: boolean; className?: string }) {
  return (
    <span className={cn('relative inline-flex h-2.5 w-2.5 shrink-0', className)} aria-hidden>
      {pulse && (
        <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping', tones[tone])} />
      )}
      <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', tones[tone])} />
    </span>
  )
}
