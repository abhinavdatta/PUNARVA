import { BatteryCharging, Check, ChevronRight, CircleDashed, Loader2, X } from 'lucide-react'
import type { TestPhase } from '@/types'
import { cn } from '@/lib/utils'
import type { PreCheck } from '@/state/testStore'

const FLOW: Array<{ id: TestPhase; label: string }> = [
  { id: 'idle', label: 'Idle' },
  { id: 'pre-checks', label: 'Pre-checks' },
  { id: 'ready', label: 'Ready' },
  { id: 'testing', label: 'Testing' },
  { id: 'processing', label: 'Processing' },
  { id: 'results', label: 'Results' },
]

const PHASE_HINTS: Partial<Record<TestPhase, string>> = {
  idle: 'Configure the test and press Start.',
  'pre-checks': 'Verifying data source, storage, and safety constraints…',
  ready: 'System ready — initializing measurement…',
  testing: 'Sampling voltage, current, and temperature…',
  processing: 'Computing statistics and completeness…',
  results: 'Test complete — report available below.',
  disconnected: 'A hardware test was requested but the device is not connected.',
  error: 'The test could not continue. Reset to try again.',
}

export function PhaseTimeline({ phase }: { phase: TestPhase }) {
  const currentIndex = FLOW.findIndex((p) => p.id === phase)

  return (
    <div>
      <ol className="flex flex-wrap items-center gap-y-3">
        {FLOW.map((step, i) => {
          const done = currentIndex > i
          const active = currentIndex === i
          return (
            <li key={step.id} className="flex items-center gap-2">
              <span
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-bold transition-colors',
                  done && 'border-sea-400/60 bg-sea-400/15 text-sea-300',
                  active && 'border-copper-500 bg-copper-500/15 text-copper-400 shadow-glowCopper',
                  !done && !active && 'border-plum-500/70 bg-plum-800/60 text-lavender/50',
                )}
                aria-current={active ? 'step' : undefined}
              >
                {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
              </span>
              <span
                className={cn(
                  'text-xs font-medium',
                  active ? 'text-copper-400' : done ? 'text-sea-300/90' : 'text-lavender/60',
                )}
              >
                {step.label}
              </span>
              {i < FLOW.length - 1 && (
                <ChevronRight className={cn('h-3.5 w-3.5', currentIndex > i ? 'text-sea-400/60' : 'text-plum-500')} aria-hidden />
              )}
            </li>
          )
        })}
      </ol>
      <p className="mt-3 text-xs leading-relaxed text-lavender">{PHASE_HINTS[phase]}</p>
    </div>
  )
}

const CHECK_ICON = {
  pending: <CircleDashed className="h-4 w-4 text-lavender/50" aria-hidden />,
  running: <Loader2 className="h-4 w-4 animate-spin text-copper-400" aria-hidden />,
  pass: <Check className="h-4 w-4 text-sea-400" aria-hidden />,
  fail: <X className="h-4 w-4 text-critical-400" aria-hidden />,
}

export function PreCheckList({ checks }: { checks: PreCheck[] }) {
  if (checks.length === 0) {
    return (
      <p className="flex items-start gap-2 text-xs leading-relaxed text-lavender/70">
        <BatteryCharging className="mt-0.5 h-4 w-4 shrink-0 text-lavender/50" aria-hidden />
        Pre-test checks run automatically when you start a test: data source, sampling timer, storage, and safety
        constraints.
      </p>
    )
  }
  return (
    <ul className="space-y-2.5">
      {checks.map((c) => (
        <li key={c.id} className="flex items-start gap-2.5">
          <span className="mt-0.5 shrink-0">{CHECK_ICON[c.status]}</span>
          <div className="min-w-0">
            <p className={cn('text-sm font-medium', c.status === 'fail' ? 'text-critical-400' : 'text-ivory/90')}>
              {c.label}
            </p>
            {c.detail && <p className="mt-0.5 text-[11px] leading-snug text-lavender/70">{c.detail}</p>}
          </div>
        </li>
      ))}
    </ul>
  )
}
