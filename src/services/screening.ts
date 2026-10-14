import type { TestRecord } from '@/types'

/**
 * 18650 screening logic — a port of the firmware experiment's decision rules
 * (main.cpp: finishTest()). It classifies a completed test as REUSE /
 * INSPECT / RECYCLE using only direct measurements:
 *
 *   RECYCLE  — sagged to/below cutoff, overheated, or implied impedance high
 *   INSPECT  — borderline impedance, temperature rise, or shallow discharge
 *   REUSE    — none of the above
 *
 * Honesty rules (README: "No fabricated intelligence"):
 *  - On DEMO data this is a demonstration of the decision procedure,
 *    NOT a real battery screening. Labels always say "simulated".
 *  - On IMPORTED data the classification is only as good as the imported
 *    numbers; the report states its assumptions.
 *  - This is a single-instrument heuristic screen, not a health verdict,
 *    capacity measurement, or safety certification. The UI notice in
 *    ResultsReport already says assessment tooling is not validated yet —
 *    this module implements the same screening the offline firmware does
 *    so the digital and hardware paths exercise the same logic.
 */

export type ScreeningResult = 'REUSE' | 'INSPECT' | 'RECYCLE'

export interface ScreeningOutcome {
  result: ScreeningResult
  /** Human-readable reasons, one line per rule that fired. */
  reasons: string[]
  /** True if inputs lacked what the firmware rules need (e.g. no load current). */
  incomplete: boolean
}

/** Firmware thresholds, kept identical where the firmware had them. */
export const SCREENING_THRESHOLDS = {
  cutoffVoltageV: 2.8,
  maxTempC: 55.0,
  inspectImpedanceOhms: 0.12,
  recycleImpedanceOhms: 0.25,
  minStartVoltageV: 3.0,
  maxStartVoltageV: 4.25,
  inspectTempRiseC: 8.0,
  inspectVoltageFloorV: 3.2,
  /** Peak current below which the impedance estimate is meaningless (firmware: 0.05 A). */
  minImpedanceCurrentA: 0.05,
} as const

/**
 * Apply the firmware's decision ladder to a completed test record.
 *
 * Assumptions (stated in the UI):
 *  - record.stats.voltage.min acts as "minimumVoltage" (voltage under load);
 *  - record.stats.voltage.max acts as "openCircuitVoltage" at start;
 *  - record.stats.current.max is peak current drawn during the test;
 *  - implied impedance = (max V − min V) / peak current — same rough
 *    sag/peak-current ratio the firmware computes after each run.
 * If the record never drew real load current, the impedance step can't
 * fire and the outcome is flagged incomplete rather than guessed.
 */
export function screenRecord(record: TestRecord): ScreeningOutcome | null {
  // Firmware rules only defined for li-ion 18650-style cells. Other
  // chemistries have different cutoffs — refuse to invent them.
  if (record.config.chemistry !== 'li-ion') return null

  const v = record.stats.voltage
  const i = record.stats.current
  const t = record.stats.temperature
  if (!v || !i) return null

  const openCircuitV = v.max
  const minimumV = v.min
  const peakCurrentA = i.max
  const lastTempC = t?.max ?? null
  const startTempC = t?.min ?? null

  const reasons: string[] = []
  let incomplete = false

  // Impedance estimate — same math as firmware (voltageDrop / peakCurrentA).
  let impedanceOhms: number | null = null
  if (peakCurrentA > SCREENING_THRESHOLDS.minImpedanceCurrentA) {
    impedanceOhms = (openCircuitV - minimumV) / peakCurrentA
  } else {
    incomplete = true
  }

  // RECYCLE gates (worst outcome first) — any one forces RECYCLE.
  const recycle =
    minimumV <= SCREENING_THRESHOLDS.cutoffVoltageV ||
    (lastTempC !== null && lastTempC >= SCREENING_THRESHOLDS.maxTempC) ||
    (impedanceOhms !== null && impedanceOhms > SCREENING_THRESHOLDS.recycleImpedanceOhms)

  if (recycle) {
    if (minimumV <= SCREENING_THRESHOLDS.cutoffVoltageV) {
      reasons.push(`Voltage sagged to ${minimumV.toFixed(2)} V — at/below the cutoff floor (${SCREENING_THRESHOLDS.cutoffVoltageV} V).`)
    }
    if (lastTempC !== null && lastTempC >= SCREENING_THRESHOLDS.maxTempC) {
      reasons.push(`Peak temperature ${lastTempC.toFixed(1)} °C reached the safety limit (${SCREENING_THRESHOLDS.maxTempC} °C).`)
    }
    if (impedanceOhms !== null && impedanceOhms > SCREENING_THRESHOLDS.recycleImpedanceOhms) {
      reasons.push(`Implied impedance ${impedanceOhms.toFixed(3)} Ω is above the ${SCREENING_THRESHOLDS.recycleImpedanceOhms} Ω gate.`)
    }
  }

  // INSPECT gates — checked only when no RECYCLE gate fired (firmware ladder).
  if (!recycle) {
    if (impedanceOhms !== null && impedanceOhms > SCREENING_THRESHOLDS.inspectImpedanceOhms) {
      reasons.push(`Implied impedance ${impedanceOhms.toFixed(3)} Ω is above the ${SCREENING_THRESHOLDS.inspectImpedanceOhms} Ω gate.`)
    }
    if (lastTempC !== null && startTempC !== null && lastTempC - startTempC > SCREENING_THRESHOLDS.inspectTempRiseC) {
      reasons.push(`Temperature rose ${(lastTempC - startTempC).toFixed(1)} °C during the run (limit ${SCREENING_THRESHOLDS.inspectTempRiseC} °C).`)
    }
    if (minimumV < SCREENING_THRESHOLDS.inspectVoltageFloorV) {
      reasons.push(`Minimum voltage ${minimumV.toFixed(2)} V dipped below ${SCREENING_THRESHOLDS.inspectVoltageFloorV} V under load.`)
    }
  }

  const finalResult: ScreeningResult = recycle ? 'RECYCLE' : reasons.length > 0 ? 'INSPECT' : 'REUSE'

  return { result: finalResult, reasons, incomplete }
}

/** One-line explanation of what this classification is (and is not). */
export function screeningDisclaimer(source: TestRecord['source']): string {
  switch (source) {
    case 'DEMO':
      return 'Screening outcome computed on SIMULATED demo data — it demonstrates the firmware’s decision logic, it does not describe a real battery.'
    case 'IMPORTED':
      return 'Screening outcome computed on imported data using min/max/avg of the import; verify the imported file contains in-load voltage and peak current.'
    case 'HARDWARE':
      return 'Screening outcome computed from validated hardware readings using the same decision rules as the installed firmware.'
  }
}
