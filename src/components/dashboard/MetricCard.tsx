import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { StatusDot, type DotTone } from '@/components/ui/StatusDot'

/**
 * Primary measurement card: large readable value + unit, icon, data source,
 * freshness and status. Never displays a fabricated live value — the value
 * string is computed by the caller from real or labelled-demo state.
 */
export function MetricCard({
  icon,
  title,
  value,
  unit,
  sourceLabel,
  sourceTone = 'grey',
  freshness,
  status,
  footer,
  className,
}: {
  icon: ReactNode
  title: string
  value: string
  unit?: string
  sourceLabel: string
  sourceTone?: DotTone
  freshness?: string
  status?: { tone: DotTone; label: string; pulse?: boolean }
  footer?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('panel group relative overflow-hidden p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-plum-800/90 text-sea-400 ring-1 ring-plum-600/70 [&>svg]:h-[18px] [&>svg]:w-[18px]">
            {icon}
          </span>
          <p className="label-caps">{title}</p>
        </div>
        {status && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-lavender/80">
            <StatusDot tone={status.tone} pulse={status.pulse} />
            {status.label}
          </span>
        )}
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="numeric font-display text-3xl font-bold tracking-tight text-ivory sm:text-4xl">{value}</span>
        {unit && <span className="text-base font-medium text-lavender">{unit}</span>}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        <span className="inline-flex items-center gap-1.5 text-lavender/80">
          <StatusDot tone={sourceTone} />
          {sourceLabel}
        </span>
        {freshness && <span className="numeric text-lavender/60">{freshness}</span>}
      </div>

      {footer && <div className="mt-3 border-t border-plum-600/50 pt-3">{footer}</div>}
    </div>
  )
}
