import type { Sample, StatSummary, TestConfig, TestRecord, TestStatus } from '@/types'

/** Aggregate a channel's min/max/avg over its valid samples. */
export function statFor(values: (number | null)[]): StatSummary | null {
  const valid = values.filter((v): v is number => v !== null)
  if (valid.length === 0) return null
  const min = Math.min(...valid)
  const max = Math.max(...valid)
  const avg = valid.reduce((a, b) => a + b, 0) / valid.length
  return { min, max, avg, count: valid.length }
}

export interface BuildRecordInput {
  id: string
  startedAt: number // epoch ms
  endedAt: number // epoch ms
  status: TestStatus
  source: TestRecord['source']
  config: TestConfig
  sampleIntervalMs: number
  expectedSamples: number
  samples: Sample[]
}

export function buildRecord(input: BuildRecordInput): TestRecord {
  const { samples, expectedSamples } = input

  const validCount = samples.filter(
    (s) => s.voltage_v !== null || s.current_a !== null || s.temperature_c !== null,
  ).length

  const completeness = expectedSamples > 0 ? validCount / expectedSamples : 0

  const missingCount = expectedSamples - validCount

  const warnings: string[] = []
  if (missingCount > 0) {
    warnings.push(
      `${missingCount} of ${expectedSamples} expected samples had no valid measurement (completeness ${(completeness * 100).toFixed(1)}%).`,
    )
  }
  if (input.status === 'stopped') {
    warnings.push('Test was stopped before the configured duration elapsed — data is partial.')
  }
  if (validCount === 0) {
    warnings.push('No valid measurements were recorded for this test.')
  }

  return {
    id: input.id,
    startedAt: new Date(input.startedAt).toISOString(),
    endedAt: new Date(input.endedAt).toISOString(),
    status: input.status,
    source: input.source,
    config: { ...input.config },
    sampleIntervalMs: input.sampleIntervalMs,
    expectedSamples,
    samples: [...samples],
    stats: {
      voltage: statFor(samples.map((s) => s.voltage_v)),
      current: statFor(samples.map((s) => s.current_a)),
      temperature: statFor(samples.map((s) => s.temperature_c)),
    },
    completeness,
    warnings,
  }
}
