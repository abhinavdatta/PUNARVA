import type { Reading, ValidationResult } from '@/types'

/**
 * Validation for incoming hardware readings. Nothing reaches the UI without
 * passing these checks — invalid, stale, or malformed data is rejected and
 * reported, never displayed as if it were live truth.
 */

/** Plausible physical ranges. Broad by design; they catch nonsense, not calibrate sensors. */
const LIMITS = {
  voltage_v: { min: -1, max: 1000 },
  current_a: { min: -100, max: 100 },
  temperature_c: { min: -50, max: 200 },
} as const

const NUMERIC_FIELDS = ['voltage_v', 'current_a', 'temperature_c'] as const

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

export function validateReading(raw: unknown): ValidationResult<Reading> {
  const errors: string[] = []

  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['Payload is not a JSON object'] }
  }

  const obj = raw as Record<string, unknown>

  for (const field of NUMERIC_FIELDS) {
    const v = obj[field]
    if (!isFiniteNumber(v)) {
      errors.push(`${field} is missing or not a finite number`)
      continue
    }
    const { min, max } = LIMITS[field]
    if (v < min || v > max) {
      errors.push(`${field}=${v} outside plausible range [${min}, ${max}]`)
    }
  }

  let timestamp: string
  const ts = obj['timestamp']
  if (typeof ts === 'string' && !Number.isNaN(new Date(ts).getTime())) {
    timestamp = ts
  } else {
    // Missing/invalid timestamp is tolerated (device clock may be unset):
    // reception time is used, but the report will show it as such.
    timestamp = new Date().toISOString()
    errors.unshift('timestamp missing or unparsable — reception time substituted')
  }

  if (errors.some((e) => !e.startsWith('timestamp'))) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    errors,
    value: {
      voltage_v: obj.voltage_v as number,
      current_a: obj.current_a as number,
      temperature_c: obj.temperature_c as number,
      timestamp,
    },
  }
}

/** A reading older than `maxAgeMs` is considered stale. */
export function isStaleReading(iso: string, maxAgeMs = 5000, now = Date.now()): boolean {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return true
  return now - t > maxAgeMs
}

/** Documented example payload — for the Settings page and README. */
export const EXAMPLE_PAYLOAD = `{
  "voltage_v": 3.72,
  "current_a": 0.45,
  "temperature_c": 28.3,
  "timestamp": "2026-10-10T14:32:05.250Z"
}`
