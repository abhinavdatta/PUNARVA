import type { Sample, TestRecord } from '@/types'

/**
 * CSV export. Exports contain the ACTUAL samples used for a report — no
 * smoothing, no gaps filled in. Empty cells mean "no valid measurement".
 */

export function downloadTextFile(filename: string, text: string, mime = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

const SAMPLES_HEADER = 'test_id,t_offset_ms,voltage_v,current_a,temperature_c'

/** One row per sample of a single test. This is the format the importer accepts back. */
export function samplesToCsv(record: TestRecord): string {
  const lines = [SAMPLES_HEADER]
  for (const s of record.samples) {
    lines.push(
      [record.id, String(s.t), cellNum(s.voltage_v), cellNum(s.current_a), cellNum(s.temperature_c)].join(','),
    )
  }
  return lines.join('\n')
}

function cellNum(v: number | null): string {
  return v === null ? '' : String(v)
}

const SUMMARY_HEADER = [
  'test_id',
  'started_at',
  'ended_at',
  'status',
  'data_source',
  'battery_id',
  'chemistry',
  'nominal_voltage_v',
  'rated_capacity_ah',
  'configured_duration_s',
  'effective_duration_s',
  'sample_interval_ms',
  'sample_count',
  'expected_samples',
  'completeness_pct',
  'voltage_min_v',
  'voltage_max_v',
  'voltage_avg_v',
  'current_min_a',
  'current_max_a',
  'current_avg_a',
  'temp_min_c',
  'temp_max_c',
  'temp_avg_c',
].join(',')

function statCells(s: { min: number; max: number; avg: number } | null): [string, string, string] {
  if (!s) return ['', '', '']
  return [String(s.min), String(s.max), String(s.avg)]
}

/** One row per test record — for exporting the whole history. */
export function recordsToSummaryCsv(records: TestRecord[]): string {
  const lines = [SUMMARY_HEADER]
  for (const r of records) {
    const v = statCells(r.stats.voltage)
    const i = statCells(r.stats.current)
    const t = statCells(r.stats.temperature)
    lines.push(
      [
        r.id,
        r.startedAt,
        r.endedAt,
        r.status,
        r.source,
        r.config.batteryId,
        r.config.chemistry,
        r.config.nominalVoltage === null ? '' : String(r.config.nominalVoltage),
        r.config.ratedCapacityAh === null ? '' : String(r.config.ratedCapacityAh),
        String(r.config.durationS),
        String(Math.round((r.samples.at(-1)?.t ?? 0) / 1000)),
        String(r.sampleIntervalMs),
        String(r.samples.length),
        String(r.expectedSamples),
        String((r.completeness * 100).toFixed(1)),
        ...v,
        ...i,
        ...t,
      ].join(','),
    )
  }
  return lines.join('\n')
}

export function exportSamplesCsv(record: TestRecord): void {
  downloadTextFile(`${record.id}-samples.csv`, samplesToCsv(record))
}

export function exportSummaryCsv(records: TestRecord[]): void {
  downloadTextFile(`punarva-test-history-${new Date().toISOString().slice(0, 10)}.csv`, recordsToSummaryCsv(records))
}

/** Parse a numeric CSV cell: '' → null, invalid → NaN (caller reports). */
export function parseCell(v: string): number | null {
  const s = v.trim()
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : Number.NaN
}

export { SAMPLES_HEADER }

export type ParsedSampleRow = Sample
