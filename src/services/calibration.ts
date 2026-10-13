import type { TestRecord } from '@/types'

/**
 * Calibration & insight groundwork.
 *
 * Honesty rules (README: "No fabricated intelligence"):
 *  - A calibration *reference* is a chosen, user-confirmed test record that
 *    serves as a comparison baseline. It is never treated as a calibrated
 *    instrument value — the battery under test is NOT the reference cell.
 *  - Insights compare a test against the reference and describe observed
 *    differences only. Nothing here outputs state-of-health, internal
 *    resistance, remaining capacity, or failure predictions, because a
 *    validated estimator does not exist (yet).
 */

export interface ReferenceInfo {
  recordId: string
  setAt: string // ISO timestamp when assigned
  /** Snapshot of the stats at reference time, so later edits to the record don't silently shift the baseline. */
  stats: TestRecord['stats']
  config: TestRecord['config']
}

export interface Insight {
  level: 'info' | 'warn' | 'neutral'
  title: string
  detail: string
}

export interface ComparisonResult {
  valid: boolean
  reason?: string
  insights: Insight[]
}

export function referenceFromRecord(record: TestRecord): ReferenceInfo {
  return {
    recordId: record.id,
    setAt: new Date().toISOString(),
    stats: JSON.parse(JSON.stringify(record.stats)),
    config: { ...record.config },
  }
}

function pctDelta(current: number, reference: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(reference) || reference === 0) return null
  return ((current - reference) / Math.abs(reference)) * 100
}

function fmtSigned(x: number | null, digits = 1): string {
  if (x === null) return '—'
  const sign = x > 0 ? '+' : ''
  return `${sign}${x.toFixed(digits)}%`
}

/**
 * Compare a fresh test against the reference within comparable envelopes:
 * same chemistry and a similar configured duration (±1 s). If the envelopes
 * don't match, the comparison refuses — similarity of test conditions is a
 * precondition for any meaningful comparison.
 */
export function compareAgainstReference(record: TestRecord, ref: ReferenceInfo | null): ComparisonResult {
  if (!ref) return { valid: false, reason: 'No reference test has been set.', insights: [] }
  if (record.id === ref.recordId) return { valid: false, reason: 'This test IS the reference.', insights: [] }

  if (record.config.chemistry !== ref.config.chemistry) {
    return {
      valid: false,
      reason: `Chemistry differs (reference: ${ref.config.chemistry}, this test: ${record.config.chemistry}). Comparisons require the same chemistry.`,
      insights: [],
    }
  }
  const durationRatio = Math.abs(record.config.durationS - ref.config.durationS) / Math.max(1, ref.config.durationS)
  if (durationRatio > 0.05) {
    return {
      valid: false,
      reason: `Test durations differ (reference: ${ref.config.durationS}s, this test: ${record.config.durationS}s). Comparisons require a similar configured duration.`,
      insights: [],
    }
  }

  const insights: Insight[] = []

  const vNow = record.stats.voltage
  const vRef = ref.stats.voltage
  if (vNow && vRef) {
    const dAvg = pctDelta(vNow.avg, vRef.avg)
    const dMin = pctDelta(vNow.min, vRef.min)
    insights.push({
      level: 'neutral',
      title: `Voltage vs reference — avg ${fmtSigned(dAvg)}, min ${fmtSigned(dMin)}`,
      detail:
        `Average voltage ${vNow.avg.toFixed(3)} V vs reference ${vRef.avg.toFixed(3)} V; ` +
        `minimum ${vNow.min.toFixed(3)} V vs ${vRef.min.toFixed(3)} V. ` +
        `A lower minimum under a comparable setup may indicate higher internal impedance or a deeper discharge state observed during this run — both are observations only, not diagnoses.`,
    })
  }

  const iNow = record.stats.current
  const iRef = ref.stats.current
  if (iNow && iRef) {
    const d = pctDelta(iNow.avg, iRef.avg)
    insights.push({
      level: 'neutral',
      title: `Current vs reference — avg ${fmtSigned(d)}`,
      detail:
        `Average current ${iNow.avg.toFixed(3)} A vs reference ${iRef.avg.toFixed(3)} A. ` +
        `If neither test drives a controlled load, current differences mainly reflect what the passive circuit drew during each run.`,
    })
  }

  const tNow = record.stats.temperature
  const tRef = ref.stats.temperature
  if (tNow && tRef) {
    const d = pctDelta(tNow.avg, tRef.avg)
    insights.push({
      level: Math.abs(tNow.max - tRef.max) > 5 ? 'warn' : 'neutral',
      title: `Temperature vs reference — avg ${fmtSigned(d)}`,
      detail:
        `Average temperature ${tNow.avg.toFixed(1)} °C vs reference ${tRef.avg.toFixed(1)} °C; ` +
        `maximum reached ${tNow.max.toFixed(1)} °C vs ${tRef.max.toFixed(1)} °C.`,
    })
  }

  const cNow = record.completeness
  if (cNow < 0.9) {
    insights.push({
      level: 'warn',
      title: `Completeness ${fmtPctLocal(cNow)} — comparison limited`,
      detail: 'This test has missing samples; statistics may under-represent the true behaviour. Aim for ≥ 90% completeness before reading too much into deltas.',
    })
  }

  if (insights.length === 0) {
    insights.push({
      level: 'neutral',
      title: 'Nothing to compare',
      detail: 'Neither the reference nor this test has valid channel statistics.',
    })
  }

  insights.unshift({
    level: 'info',
    title: 'Observations only — not a health verdict',
    detail:
      'These deltas describe differences between two runs. They are not state-of-health, capacity, or failure predictions; a validated estimator requires calibrated hardware and controlled, repeatable test conditions.',
  })

  return { valid: true, insights }
}

function fmtPctLocal(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`
}
