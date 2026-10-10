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

export class DemoSampler {
  private rng: () => number
  private phase: number
  private readonly v0: number

  constructor(chemistry: string, nominalVoltage: number | null, seed = Math.floor(Math.random() * 2 ** 31)) {
    this.rng = mulberry32(seed)
    this.phase = this.rng() * Math.PI * 2
    const base = BASE_VOLTAGE[chemistry]
    if (base !== undefined) {
      this.v0 = base
    } else if (nominalVoltage && nominalVoltage > 0) {
      this.v0 = nominalVoltage * 1.08
    } else {
      this.v0 = 3.7
    }
  }

  /**
   * @param tSeconds seconds since test start
   * @returns sample values, or `null` for a deliberately dropped tick
   */
  next(tSeconds: number): DemoSample | null {
    // Deliberate missing sample (demo of completeness handling)
    if (this.rng() < 0.015) return null

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
}

function round(v: number, digits: number): number {
  const f = 10 ** digits
  return Math.round(v * f) / f
}
