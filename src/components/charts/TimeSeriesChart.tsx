import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Sample } from '@/types'
import { AXIS_LINE, AXIS_TICK, GRID_STROKE, SERIES_COLORS } from './chartTheme'

export type Channel = 'voltage_v' | 'current_a' | 'temperature_c'

const CHANNEL_META: Record<Channel, { label: string; unit: string; digits: number }> = {
  voltage_v: { label: 'Voltage', unit: 'V', digits: 3 },
  current_a: { label: 'Current', unit: 'A', digits: 3 },
  temperature_c: { label: 'Temperature', unit: '°C', digits: 1 },
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ payload: Sample }>
  channel: Channel
  unit: string
  digits: number
}

function ChartTooltip({ active, payload, channel, unit, digits }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const d = payload[0].payload
  const v = d[channel]
  return (
    <div className="rounded-lg border border-plum-500/70 bg-plum-900/95 px-3 py-2 shadow-panel">
      <p className="numeric text-[11px] text-lavender/80">t = {(d.t / 1000).toFixed(2)} s</p>
      <p className="numeric text-sm font-semibold text-ivory">
        {v === null ? 'no valid sample' : `${v.toFixed(digits)} ${unit}`}
      </p>
    </div>
  )
}

/**
 * Time-series line chart. Gaps (null channels) render as visible breaks —
 * missing data is never smoothed over or fabricated.
 */
export function TimeSeriesChart({
  samples,
  channel,
  height = 240,
}: {
  samples: Sample[]
  channel: Channel
  height?: number
}) {
  const meta = CHANNEL_META[channel]
  const color = SERIES_COLORS[channel.replace('_v', '').replace('_a', '').replace('_c', '') as keyof typeof SERIES_COLORS]

  return (
    <div style={{ height }} aria-label={`${meta.label} over time chart`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={samples} margin={{ top: 8, right: 14, bottom: 4, left: 0 }}>
          <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 5" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={['dataMin', 'dataMax']}
            tick={AXIS_TICK}
            tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}s`}
            axisLine={AXIS_LINE}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={56}
            domain={['auto', 'auto']}
            tickFormatter={(v: number) => v.toFixed(meta.digits)}
            label={{ value: meta.unit, angle: -90, position: 'insideLeft', fill: '#C7B7CC', fontSize: 11, offset: 12 }}
          />
          <Tooltip content={<ChartTooltip channel={channel} unit={meta.unit} digits={meta.digits} />} cursor={{ stroke: 'rgba(255,147,107,0.35)' }} />
          <Line
            type="monotone"
            dataKey={channel}
            name={`${meta.label} (${meta.unit})`}
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3.5, strokeWidth: 0 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
