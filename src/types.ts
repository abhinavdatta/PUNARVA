/**
 * PUNARVA core domain types.
 *
 * Honesty rules encoded here:
 * - A `Sample` channel is `null` when no valid measurement exists for it.
 * - Every `TestRecord` carries its `source` so demo data can never be
 *   presented as a real hardware measurement.
 */

export type DataSource = 'DEMO' | 'HARDWARE' | 'IMPORTED'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export type TestPhase =
  | 'idle'
  | 'pre-checks'
  | 'ready'
  | 'testing'
  | 'processing'
  | 'results'
  | 'disconnected'
  | 'error'

export type TestStatus = 'completed' | 'stopped'

export type ComponentStatus = 'planned' | 'in-development' | 'implemented' | 'connected'

export type TestDurationS = 15 | 30 | 60 | 120

/** Example hardware payload shape (documented protocol). Values are illustrative only. */
export interface Reading {
  voltage_v: number
  current_a: number
  temperature_c: number
  timestamp: string // ISO-8601
}

/** One measurement sample. `null` = no valid measurement at this tick. */
export interface Sample {
  /** Milliseconds since test start. */
  t: number
  voltage_v: number | null
  current_a: number | null
  temperature_c: number | null
}

export interface StatSummary {
  min: number
  max: number
  avg: number
  count: number
}

export interface TestConfig {
  batteryId: string
  chemistry: string
  nominalVoltage: number | null
  ratedCapacityAh: number | null
  durationS: TestDurationS
}

export interface TestRecord {
  id: string
  startedAt: string // ISO
  endedAt: string // ISO
  status: TestStatus
  source: DataSource
  config: TestConfig
  sampleIntervalMs: number
  expectedSamples: number
  samples: Sample[]
  stats: {
    voltage: StatSummary | null
    current: StatSummary | null
    temperature: StatSummary | null
  }
  /** valid samples / expected samples, 0..1 */
  completeness: number
  warnings: string[]
}

export type EventLevel = 'info' | 'warn' | 'error'

export interface SystemEvent {
  id: string
  at: string // ISO
  level: EventLevel
  message: string
}

export interface ValidationResult<T> {
  ok: boolean
  value?: T
  errors: string[]
}
