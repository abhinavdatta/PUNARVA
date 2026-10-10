import { Link } from 'react-router-dom'
import { ArrowRight, FlaskConical, Inbox } from 'lucide-react'
import type { TestRecord } from '@/types'
import { fmtDateTime, fmtPct } from '@/lib/format'
import { shortId } from '@/lib/id'
import { Badge, DataSourceBadge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'

export function RecentTests({ records, limit = 5 }: { records: TestRecord[]; limit?: number }) {
  const recent = records.slice(0, limit)

  if (recent.length === 0) {
    return (
      <EmptyState
        icon={<Inbox aria-hidden />}
        title="No tests recorded yet"
        description="Completed tests appear here with their measurement summary. Run one from Battery Check."
      />
    )
  }

  return (
    <ul className="divide-y divide-plum-600/50">
      {recent.map((r) => (
        <li key={r.id}>
          <Link
            to={`/results/${r.id}`}
            className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-plum-800/50 focus-visible:bg-plum-800/50"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-plum-800 text-copper-400 ring-1 ring-plum-600/70">
              <FlaskConical className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="numeric truncate text-sm font-semibold text-ivory">
                {shortId(r.id)} <span className="font-normal text-lavender/70">· {r.config.batteryId || 'unnamed battery'}</span>
              </p>
              <p className="numeric mt-0.5 text-[11px] text-lavender/60">{fmtDateTime(r.startedAt)}</p>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <DataSourceBadge source={r.source} />
              <Badge tone={r.completeness >= 0.95 ? 'teal' : 'amber'}>{fmtPct(r.completeness, 0)} complete</Badge>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-lavender/50" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  )
}
