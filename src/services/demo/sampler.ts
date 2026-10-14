/**
 * Demo measurement generator.
 *
 * Produces a physically plausible, clearly-labelled SIMULATED discharge
 * response for a battery under a small constant load. Every value produced
 * here is demo data — the UI must always label it as such.
 *
 * ~1.5% of ticks are randomly dropped on purpose so the UI's missing-sample
 * handling (completeness %, warnings, chart gaps) is exercised and visible.
 */

export interface DemoSample {
  voltage_v: number
  current_a: number
  temperature_c: number
}

/** Deterministic PRNG (mulberry32) so a given test is reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const BASE_VOLTAGE: Record<string, number> = {
  'li-ion': 4.05,
  lifepo4: 3.35,
  'lead-acid': 12.6,
  nimh: 1.38,
  alkaline: 1.58,
}

/**
 * Simulated cell-health scenarios, mirroring the firmware experiment's
 * screening classes. Pick one by putting a keyword in the battery ID
 * (e.g. "cell-3 weak"), or leave it out for a plausible default.
 *   healthy  — small sag, warm-up < 2 °C, screens REUSE
 *   weak     — larger sag, temp rise ~9 °C — typically screens INSPECT
 *   failing  — sags to/past cutoff, heats up — typically screens RECYCLE
 */
export type DemoScenario = 'healthy' | 'weak' | 'failing'

export function scenarioForBatteryId(batteryId: string): DemoScenario | null {
  const id = batteryId.toLowerCase()
  if (/\bfail|recycle|dead\b/.test(id)) return 'failing'
  if (/\bweak|inspect|worn\b/.test(id)) return 'weak'
  if (/\bhealthy|good|new\b/.test(id)) return 'healthy'
  return null
}

interface ScenarioProfile {
  /** Peak voltage under load at t=0 (V). */
  v0: number
  /** Sag magnitude exponential time-constant (s) — small = fast initial sag. */
  sagTau: number
  /** Total sag magnitude (V). */
  sagAmount: number
  /** Linear decline rate (V/s). */
  declineRate: number
  /** Load current (A). */
  loadCurrent: number
  /** Starting temperature (°C). */
  tempStart: number
  /** Temperature rise rate (°C/s). */
  tempRisePerS: number
}

const SCENARIOS: Record<DemoScenario, ScenarioProfile> = {
  healthy: { v0: 4.05, sagTau: 8, sagAmount: 0.05, declineRate: 0.00016, loadCurrent: 0.45, tempStart: 28.0, tempRisePerS: 0.045 },
  weak: { v0: 3.95, sagTau: 5, sagAmount: 0.06, declineRate: 0.0002, loadCurrent: 0.42, tempStart: 28.5, tempRisePerS: 0.26 },
  failing: { v0: 3.6, sagTau: 3, sagAmount: 0.45, declineRate: 0.014, loadCurrent: 0.38, tempStart: 29.0, tempRisePerS: 0.9 },
}

export class DemoSampler {
  private rng: () => number
  private phase: number
  private readonly v0: number
  private readonly profile: ScenarioProfile | null

  constructor(
    chemistry: string,
    nominalVoltage: number | null,
    seed = Math.floor(Math.random() * 2 ** 31),
    scenario: DemoScenario | null = null,
    batteryIdHint = '',
  ) {
    this.rng = mulberry32(seed)
    this.phase = this.rng() * Math.PI * 2
    this.profile = scenario && chemistry === 'li-ion' ? SCENARIOS[scenario] : null
    const base = BASE_VOLTAGE[chemistry]
    if (base !== undefined) {
      this.v0 = base
    } else if (nominalVoltage && nominalVoltage > 0) {
      this.v0 = nominalVoltage * 1.08
    } else {
      this.v0 = 3.7
    }
    void batteryIdHint
  }

  /**
   * @param tSeconds seconds since test start
   * @returns sample values, or `null` for a deliberately dropped tick
   */
  next(tSeconds: number): DemoSample | null {
    // Deliberate missing sample (demo of completeness handling)
    if (this.rng() < 0.015) return null

    if (this.profile) {
      return this.scenarioNext(tSeconds)
    }

    // Voltage: initial sag under load, then slow decline with small wander
    const sag = 0.05 * (1 - Math.exp(-tSeconds / 8))
    const decline = 0.0004 * this.v0 * tSeconds
    const wander = 0.004 * this.v0 * Math.sin(tSeconds / 9 + this.phase)
    const noiseV = (this.rng() - 0.5) * 0.006 * this.v0
    const voltage_v = this.v0 - sag - decline + wander + noiseV

    // Current: roughly constant small load with slight ripple
    const ripple = 0.012 * Math.sin(tSeconds / 6 + this.phase / 2)
    const noiseI = (this.rng() - 0.5) * 0.008
    const current_a = Math.max(0.01, 0.45 * (1 + ripple + noiseI))

    // Temperature: slow rise from ambient
    const noiseT = (this.rng() - 0.5) * 0.08
    const temperature_c = 28.0 + 0.005 * tSeconds + noiseT

    return {
      voltage_v: round(voltage_v, 4),
      current_a: round(current_a, 4),
      temperature_c: round(temperature_c, 2),
    }
  }

  /** Firmware-experiment-shaped responses for li-ion cell-health scenarios. */
  private scenarioNext(tSeconds: number): DemoSample {
    const p = this.profile!
    const sag = p.sagAmount * (1 - Math.exp(-tSeconds / p.sagTau))
    const decline = p.declineRate * this.v0 * tSeconds
    const wander = 0.003 * this.v0 * Math.sin(tSeconds / 9 + this.phase)
    const noiseV = (this.rng() - 0.5) * 0.008 * this.v0
    const voltage_v = Math.max(1.5, p.v0 - sag - decline + wander + noiseV)

    const ripple = 0.01 * Math.sin(tSeconds / 6 + this.phase / 2)
    const noiseI = (this.rng() - 0.5) * 0.01
    const current_a = Math.max(0.01, p.loadCurrent * (1 + ripple + noiseI))

    const noiseT = (this.rng() - 0.5) * 0.15
    const temperature_c = p.tempStart + p.tempRisePerS * tSeconds + noiseT

    return {
      voltage_v: round(voltage_v, 4),
      current_a: round(current_a, 4),
      temperature_c: round(temperature_c, 2),
    }
  }
}

function round(v: number, digits: number): number {
  const f = 10 ** digits
  return Math.round(v * f) / f
}
