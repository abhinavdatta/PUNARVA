import { Terminal } from 'lucide-react'
import { useDeviceStore } from '@/state/deviceStore'
import { fmtTime } from '@/lib/format'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatusDot } from '@/components/ui/StatusDot'
import { cn } from '@/lib/utils'

export function EventLog({ limit = 12, className }: { limit?: number; className?: string }) {
  const events = useDeviceStore((s) => s.events)
  const recent = [...events].reverse().slice(0, limit)

  return (
    <Card className={className}>
      <CardHeader title="System events" icon={<Terminal aria-hidden />} subtitle="Connection, validation, and test workflow log" />
      <CardBody className="pt-4">
        {recent.length === 0 ? (
          <EmptyState icon={<Terminal aria-hidden />} title="No events yet" description="System activity will be logged here." className="py-6" />
        ) : (
          <ul className="space-y-2.5">
            {recent.map((e) => (
              <li key={e.id} className="flex items-start gap-2.5">
                <StatusDot
                  tone={e.level === 'error' ? 'red' : e.level === 'warn' ? 'amber' : 'teal'}
                  className="mt-1.5"
                />
                <div className="min-w-0 flex-1">
                  <p className={cn('text-xs leading-snug', e.level === 'info' ? 'text-lavender' : 'text-ivory/90')}>
                    {e.message}
                  </p>
                  <p className="numeric mt-0.5 text-[10px] text-lavender/50">{fmtTime(e.at)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}
