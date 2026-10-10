import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { ComponentStatus, DataSource } from '@/types'
import { STATUS_LABEL } from '@/data/components'

type Tone = 'teal' | 'copper' | 'amber' | 'red' | 'neutral' | 'plum'

const tones: Record<Tone, string> = {
  teal: 'bg-sea-400/12 text-sea-300 border-sea-400/35',
  copper: 'bg-copper-500/12 text-copper-400 border-copper-500/35',
  amber: 'bg-amber-400/12 text-amber-400 border-amber-400/35',
  red: 'bg-critical-500/12 text-critical-400 border-critical-500/35',
  neutral: 'bg-plum-600/40 text-lavender border-plum-500/50',
  plum: 'bg-plum-800/80 text-lavender border-plum-500/40',
}

export function Badge({
  children,
  tone = 'neutral',
  className,
  icon,
}: {
  children: ReactNode
  tone?: Tone
  className?: string
  icon?: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider',
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}

export function DataSourceBadge({ source, className }: { source: DataSource; className?: string }) {
  const map: Record<DataSource, { tone: Tone; label: string }> = {
    DEMO: { tone: 'amber', label: 'Demo data' },
    HARDWARE: { tone: 'teal', label: 'Hardware' },
    IMPORTED: { tone: 'plum', label: 'Imported' },
  }
  const { tone, label } = map[source]
  return (
    <Badge tone={tone} className={className}>
      {label}
    </Badge>
  )
}

const statusTone: Record<ComponentStatus, Tone> = {
  planned: 'neutral',
  'in-development': 'amber',
  implemented: 'teal',
  connected: 'copper',
}

export function ComponentStatusBadge({ status, className }: { status: ComponentStatus; className?: string }) {
  return (
    <Badge tone={statusTone[status]} className={className}>
      {STATUS_LABEL[status]}
    </Badge>
  )
}
