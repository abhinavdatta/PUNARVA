import { Download, FileWarning, Info, Recycle, ShieldAlert, Star, StarOff } from 'lucide-react'
import type { StatSummary, TestRecord } from '@/types'
import { fmtDateTime, fmtNum, fmtPct } from '@/lib/format'
import { chemistryLabel } from '@/data/chemistry'
import { exportSamplesCsv } from '@/services/csv/exportCsv'
import { compareAgainstReference, referenceFromRecord } from '@/services/calibration'
import { screenRecord, screeningDisclaimer } from '@/services/screening'
import { useCalibrationStore } from '@/state/calibrationStore'
import { useDeviceStore } from '@/state/deviceStore'
import { Badge, DataSourceBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { ChartCard } from '@/components/charts/ChartCard'
import { cn } from '@/lib/utils'

const HEALTH_NOTICE =
  'Battery health assessment unavailable — validated test data and calibration required.'

function StatBlock({ label, unit, stat, digits }: { label: string; unit: string; stat: StatSummary | null; digits: number }) {
  return (
    <div className="rounded-lg border border-plum-600/60 bg-plum-800/40 p-4">
      <p className="label-caps mb-2">{label}</p>
      {stat === null ? (
        <p className="text-sm text-lavender/70">Insufficient valid samples</p>
      ) : (
        <dl className="space-y-1.5 text-sm">
          {(
            [
              ['Min', stat.min],
              ['Max', stat.max],
              ['Avg', stat.avg],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-3">
              <dt className="text-xs text-lavender/70">{k}</dt>
              <dd className="numeric font-semibold text-ivory">
                {fmtNum(v, digits)} <span className="text-xs font-normal text-lavender/70">{unit}</span>
              </dd>
            </div>
          ))}
          <p className="pt-1 text-[11px] text-lavender/50">from {stat.count} valid sample{stat.count === 1 ? '' : 's'}</p>
        </dl>
      )}
    </div>
  )
}

/**
 * Premium engineering report for one test. Source (DEMO / HARDWARE / IMPORTED)
 * is always visible. No state-of-health, internal-resistance, capacity, or
 * safety claim is ever produced.
 */
export function ResultsReport({ record }: { record: TestRecord }) {
  const reference = useCalibrationStore((s) => s.reference)
  const setReference = useCalibrationStore((s) => s.setReference)
  const pushEvent = useDeviceStore((s) => s.pushEvent)
  const isReference = reference?.recordId === record.id
  const comparison = compareAgainstReference(record, reference)
  const screening = screenRecord(record)

  const sourceNote =
    record.source === 'DEMO'
      ? 'This report was produced from simulated demo data. It is not a measurement of a real battery.'
      : record.source === 'HARDWARE'
        ? 'This report was produced from validated readings received from connected hardware.'
        : 'This report was imported from an external CSV file (e.g. device MicroSD logs transferred manually).'

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardBody className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="numeric font-display text-xl font-bold tracking-tight text-ivory">{record.id}</h2>
                <DataSourceBadge source={record.source} />
                <Badge tone={record.status === 'completed' ? 'teal' : 'amber'}>
                  {record.status === 'completed' ? 'Completed' : 'Stopped early'}
                </Badge>
              </div>
              <p className="numeric mt-1.5 text-sm text-lavender">{fmtDateTime(record.startedAt)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={isReference ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => {
                  if (isReference) {
                    setReference(null)
                    pushEvent('info', 'Calibration reference cleared.')
                  } else {
                    setReference(referenceFromRecord(record))
                    pushEvent('info', `Test ${record.id} set as calibration reference (baseline for comparisons).`)
                  }
                }}
                title={
                  isReference
                    ? 'This test is the comparison baseline. Click to clear.'
                    : 'Set this completed test as the comparison baseline for future tests with the same chemistry and duration.'
                }
              >
                {isReference ? <StarOff className="h-4 w-4" aria-hidden /> : <Star className="h-4 w-4" aria-hidden />}
                {isReference ? 'Reference set — clear' : 'Set as reference'}
              </Button>
              <Button variant="teal" size="sm" onClick={() => exportSamplesCsv(record)}>
                <Download className="h-4 w-4" aria-hidden /> Export CSV
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-plum-600/50 pt-4 text-sm sm:grid-cols-3 lg:grid-cols-6">
            {(
              [
                ['Battery', record.config.batteryId || 'Unnamed battery'],
                ['Chemistry', chemistryLabel(record.config.chemistry)],
                ['Nominal voltage', record.config.nominalVoltage === null ? '—' : `${record.config.nominalVoltage} V`],
                ['Rated capacity', record.config.ratedCapacityAh === null ? '—' : `${record.config.ratedCapacityAh} Ah`],
                ['Configured duration', `${record.config.durationS} s`],
                ['Sample interval', `${record.sampleIntervalMs} ms`],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <p className="text-[11px] uppercase tracking-wider text-lavender/60">{k}</p>
                <p className="numeric mt-0.5 font-medium text-ivory">{v}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-plum-600/50 pt-4 text-sm sm:grid-cols-4">
            {(
              [
                ['Samples recorded', `${record.samples.length}`],
                ['Expected samples', `${record.expectedSamples}`],
                ['Measurement completeness', fmtPct(record.completeness)],
                ['Effective duration', `${Math.round((record.samples.at(-1)?.t ?? 0) / 1000)} s`],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <p className="text-[11px] uppercase tracking-wider text-lavender/60">{k}</p>
                <p className="numeric mt-0.5 font-medium text-ivory">{v}</p>
              </div>
            ))}
          </div>

          <p className="flex items-start gap-2 rounded-lg border border-plum-500/50 bg-plum-800/50 px-3.5 py-3 text-xs leading-relaxed text-lavender">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-sea-400" aria-hidden />
            {sourceNote}
          </p>
        </CardBody>
      </Card>

      {/* Honest capability notice */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/8 px-4 py-3.5">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-hidden />
        <div>
          <p className="text-sm font-semibold text-amber-400">{HEALTH_NOTICE}</p>
          <p className="mt-1 text-xs leading-relaxed text-lavender/80">
            No state of health, internal resistance, remaining capacity, safety certification, or failure
            prediction is derived from this data. Assessment algorithms will be added only after validated
            test data and calibration exist.
          </p>
        </div>
      </div>

      {/* Screening outcome — firmware decision rules, labelled by data source */}
      {screening && (
        <Card>
          <CardHeader
            title="Screening outcome"
            icon={<Recycle aria-hidden />}
            subtitle="REUSE / INSPECT / RECYCLE ladder from the firmware experiment's decision rules"
            actions={
              <Badge
                tone={screening.result === 'REUSE' ? 'teal' : screening.result === 'INSPECT' ? 'copper' : 'red'}
              >
                {screening.result}
              </Badge>
            }
          />
          <CardBody className="space-y-3">
            <p className="text-xs leading-relaxed text-lavender/80">{screeningDisclaimer(record.source)}</p>
            {screening.reasons.length > 0 ? (
              <ul className="space-y-2">
                {screening.reasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-lavender">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden />
                    {r}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-lavender">
                No screening gate fired — voltage stayed above the cutoff floor, temperature stayed within limits,
                and implied impedance stayed below the inspect threshold.
              </p>
            )}
            {screening.incomplete && (
              <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3.5 py-2.5 text-xs leading-relaxed text-amber-400">
                Peak load current was below 0.05 A, so the impedance step of the ladder could not run — outcome is
                based on the voltage and temperature gates only.
              </p>
            )}
          </CardBody>
        </Card>
      )}

      {/* Statistics */}
      <Card>
        <CardHeader title="Measurement statistics" icon={<Info aria-hidden />} subtitle="Min / max / average over valid samples" />
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <StatBlock label="Voltage" unit="V" stat={record.stats.voltage} digits={3} />
          <StatBlock label="Current" unit="A" stat={record.stats.current} digits={3} />
          <StatBlock label="Temperature" unit="°C" stat={record.stats.temperature} digits={1} />
        </CardBody>
      </Card>

      {/* Reference comparison — observations only, never a health verdict */}
      <Card>
        <CardHeader
          title="Comparison against reference test"
          icon={<Star aria-hidden />}
          subtitle="Observed deltas between this run and your chosen baseline — same chemistry and duration required"
          actions={
            !reference ? (
              <Badge tone="neutral">No reference</Badge>
            ) : isReference ? (
              <Badge tone="copper">This is the reference</Badge>
            ) : comparison.valid ? (
              <Badge tone="teal">Compared</Badge>
            ) : (
              <Badge tone="amber">Not comparable</Badge>
            )
          }
        />
        <CardBody className="space-y-3">
          {!reference && (
            <p className="text-xs leading-relaxed text-lavender/80">
              Open a completed test and choose <strong className="text-ivory">Set as reference</strong> to establish a
              baseline. Future tests with the same chemistry and configured duration will be compared against it
              here — as observed differences only.
            </p>
          )}
          {reference && !isReference && !comparison.valid && (
            <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3.5 py-2.5 text-xs leading-relaxed text-amber-400">
              {comparison.reason}
            </p>
          )}
          {comparison.valid && (
            <ul className="space-y-2.5">
              {comparison.insights.map((insight, i) => (
                <li
                  key={i}
                  className={cn(
                    'rounded-lg border px-3.5 py-3',
                    insight.level === 'warn'
                      ? 'border-amber-400/30 bg-amber-400/8'
                      : insight.level === 'info'
                        ? 'border-sea-400/30 bg-sea-400/8'
                        : 'border-plum-500/50 bg-plum-800/40',
                  )}
                >
                  <p className="text-sm font-semibold text-ivory">{insight.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-lavender/85">{insight.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* Charts */}
      <div className="grid gap-5 xl:grid-cols-3">
        <ChartCard title="Voltage response" channel="voltage_v" samples={record.samples} source={record.source} height={220} />
        <ChartCard title="Current trend" channel="current_a" samples={record.samples} source={record.source} height={220} />
        <ChartCard title="Temperature trend" channel="temperature_c" samples={record.samples} source={record.source} height={220} />
      </div>

      {/* Warnings */}
      {record.warnings.length > 0 && (
        <Card>
          <CardHeader
            title="Data quality warnings"
            icon={<FileWarning aria-hidden />}
            actions={<Badge tone="amber">{record.warnings.length}</Badge>}
          />
          <CardBody className="pt-4">
            <ul className="space-y-2">
              {record.warnings.map((w, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-lavender">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden />
                  {w}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
