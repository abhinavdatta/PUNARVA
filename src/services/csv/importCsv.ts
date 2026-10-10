import type { TestRecord } from '@/types'
import { newTestId } from '@/lib/id'
import { SAMPLES_HEADER } from './exportCsv'

/**
 * CSV import with strict structure validation. Used for bringing in records
 * that were logged elsewhere (e.g. exported from the ESP32's MicroSD card).
 * Invalid files produce a precise error — we never guess.
 */

export interface ImportResult {
  ok: boolean
  record?: TestRecord
  errors: string[]
  warnings: string[]
}

interface ParsedCsv {
  header: string[]
  rows: string[][]
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

export function parseCsv(text: string): ParsedCsv {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length === 0) return { header: [], rows: [] }
  return {
    header: splitCsvLine(lines[0]).map((h) => canonicalColumn(h.trim().toLowerCase())),
    rows: lines.slice(1).map(splitCsvLine),
  }
}

const COLUMN_ALIASES: Record<string, string> = {
  t_offset_ms: 't_offset_ms',
  t_ms: 't_offset_ms',
  time_ms: 't_offset_ms',
  voltage_v: 'voltage_v',
  voltage: 'voltage_v',
  current_a: 'current_a',
  current: 'current_a',
  temperature_c: 'temperature_c',
  temperature: 'temperature_c',
  temp_c: 'temperature_c',
}

/** Resolve a header name to its canonical column (aliases above). */
function canonicalColumn(header: string): string {
  return COLUMN_ALIASES[header] ?? header
}

/**
 * Import a samples CSV in the exported format:
 *   test_id,t_offset_ms,voltage_v,current_a,temperature_c
 * `test_id` column is optional (a fresh ID is generated when absent).
 */
export function importSamplesCsv(text: string): ImportResult {
  const errors: string[] = []
  const warnings: string[] = []

  const { header, rows } = parseCsv(text)

  if (header.length === 0) {
    return { ok: false, errors: ['File is empty or unreadable'], warnings }
  }

  // Validate required structure
  const missing = ['t_offset_ms', 'voltage_v', 'current_a', 'temperature_c'].filter(
    (c) => !header.includes(c),
  )
  if (missing.length > 0) {
    return {
      ok: false,
      errors: [
        `Invalid file structure: missing required column(s) ${missing.join(', ')}.`,
        `Expected header: "${SAMPLES_HEADER}"`,
      ],
      warnings,
    }
  }

  const idx = (name: string) => header.indexOf(name)
  const tIdx = idx('t_offset_ms')
  const vIdx = idx('voltage_v')
  const iIdx = idx('current_a')
  const tCIdx = idx('temperature_c')
  const idIdx = idx('test_id')

  let testId = idIdx >= 0 && rows[0]?.[idIdx]?.trim() ? rows[0][idIdx].trim() : ''
  let idMismatch = false

  const samples: TestRecord['samples'] = []

  rows.forEach((row, n) => {
    const rowNo = n + 2 // 1-based, accounting for header

    if (idIdx >= 0) {
      const rowId = row[idIdx]?.trim() ?? ''
      if (rowId && !testId) testId = rowId
      if (rowId && testId && rowId !== testId) idMismatch = true
    }

    const rawT = row[tIdx]?.trim() ?? ''
    const t = Number(rawT)
    if (!rawT || !Number.isFinite(t) || t < 0) {
      errors.push(`Row ${rowNo}: t_offset_ms "${rawT}" is not a valid non-negative number`)
      return
    }

    const parseChannel = (raw: string | undefined, label: string): number | null => {
      const s = (raw ?? '').trim()
      if (s === '') return null
      const num = Number(s)
      if (!Number.isFinite(num)) {
        errors.push(`Row ${rowNo}: ${label} "${s}" is not a valid number`)
        return null
      }
      return num
    }

    samples.push({
      t,
      voltage_v: parseChannel(row[vIdx], 'voltage_v'),
      current_a: parseChannel(row[iIdx], 'current_a'),
      temperature_c: parseChannel(row[tCIdx], 'temperature_c'),
    })
  })

  if (idMismatch) warnings.push('test_id column contains mixed values; the first value was used.')
  if (testId === '') testId = newTestId()

  if (samples.length === 0) {
    errors.push('No valid sample rows found — nothing imported.')
  }

  if (errors.length > 0) {
    return { ok: false, errors, warnings }
  }

  const effectiveMs = samples.at(-1)?.t ?? 0
  const source: TestRecord['source'] = 'IMPORTED'
  const durationS = Math.max(1, Math.round(effectiveMs / 1000))

  const record: TestRecord = {
    id: testId,
    startedAt: new Date(Date.now() - effectiveMs).toISOString(),
    endedAt: new Date().toISOString(),
    status: 'completed',
    source,
    config: {
      batteryId: 'Imported record',
      chemistry: 'other',
      nominalVoltage: null,
      ratedCapacityAh: null,
      durationS: durationS as TestRecord['config']['durationS'],
    },
    sampleIntervalMs: samples.length > 1 ? Math.round((samples.at(-1)!.t - samples[0].t) / (samples.length - 1)) : 1000,
    expectedSamples: samples.length,
    samples,
    stats: computeImportStats(samples),
    completeness: 1,
    warnings,
  }

  const missingChannels = [
    record.stats.voltage === null && 'voltage',
    record.stats.current === null && 'current',
    record.stats.temperature === null && 'temperature',
  ].filter(Boolean)
  if (missingChannels.length > 0) {
    record.warnings.push(`No valid ${missingChannels.join('/')} values were present in the file.`)
  }

  return { ok: true, record, errors: [], warnings: record.warnings }
}

function computeImportStats(samples: TestRecord['samples']): TestRecord['stats'] {
  return {
    voltage: statFor(samples.map((s) => s.voltage_v)),
    current: statFor(samples.map((s) => s.current_a)),
    temperature: statFor(samples.map((s) => s.temperature_c)),
  }
}

function statFor(values: (number | null)[]): TestRecord['stats']['voltage'] {
  const valid = values.filter((v): v is number => v !== null)
  if (valid.length === 0) return null
  const min = Math.min(...valid)
  const max = Math.max(...valid)
  const avg = valid.reduce((a, b) => a + b, 0) / valid.length
  return { min, max, avg, count: valid.length }
}
