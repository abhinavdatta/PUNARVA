import type { ReactNode } from 'react'
import { Activity } from 'lucide-react'
import type { DataSource } from '@/types'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { TimeSeriesChart, type Channel } from './TimeSeriesChart'

export function ChartCard({
  title,
  channel,
  samples,
  source,
  actions,
  height = 240,
}: {
  title: string
  channel: Channel
  samples: { t: number; voltage_v: number | null; current_a: number | null; temperature_c: number | null }[]
  source: DataSource | null
  actions?: ReactNode
  height?: number
}) {
  const hasData = samples.some((s) => s[channel] !== null)
  return (
    <Card>
      <CardHeader
        title={title}
        icon={<Activity aria-hidden />}
        actions={
          <>
            {source && <DataSourceTag source={source} />}
            {actions}
          </>
        }
      />
      <CardBody className="pt-4">
        {hasData ? (
          <TimeSeriesChart samples={samples} channel={channel} height={height} />
        ) : (
          <EmptyState
            icon={<Activity aria-hidden />}
            title="No measurement data yet"
            description="Start a test to see the measured response here. Gaps in a chart mean samples with no valid measurement."
            className="py-8"
          />
        )}
      </CardBody>
    </Card>
  )
}

function DataSourceTag({ source }: { source: DataSource }) {
  if (source === 'DEMO') return <Badge tone="amber">Simulated</Badge>
  if (source === 'HARDWARE') return <Badge tone="teal">Hardware</Badge>
  return <Badge tone="plum">Imported</Badge>
}
