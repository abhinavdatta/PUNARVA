import { create } from 'zustand'
import type { Sample, TestConfig, TestPhase, TestRecord } from '@/types'

export interface PreCheck {
  id: string
  label: string
  status: 'pending' | 'running' | 'pass' | 'fail'
  detail?: string
}

export const SAMPLE_INTERVAL_MS = 250 // 4 Hz

export const DEFAULT_CONFIG: TestConfig = {
  batteryId: '',
  chemistry: 'li-ion',
  nominalVoltage: null,
  ratedCapacityAh: null,
  durationS: 30,
}

interface TestState {
  phase: TestPhase
  source: 'DEMO' | 'HARDWARE'
  config: TestConfig
  preChecks: PreCheck[]
  samples: Sample[]
  startedAt: number | null
  elapsedMs: number
  expectedSamples: number
  error: string | null
  result: TestRecord | null

  setPhase: (p: TestPhase) => void
  setSource: (s: 'DEMO' | 'HARDWARE') => void
  setConfig: (c: Partial<TestConfig>) => void
  setPreChecks: (checks: PreCheck[]) => void
  setPreCheck: (id: string, status: PreCheck['status'], detail?: string) => void
  beginRun: (startedAt: number, expectedSamples: number) => void
  appendSample: (s: Sample) => void
  setElapsed: (ms: number) => void
  setError: (message: string | null) => void
  setResult: (r: TestRecord | null) => void
  resetRuntime: () => void
}

export const useTestStore = create<TestState>()((set) => ({
  phase: 'idle',
  source: 'DEMO',
  config: { ...DEFAULT_CONFIG },
  preChecks: [],
  samples: [],
  startedAt: null,
  elapsedMs: 0,
  expectedSamples: 0,
  error: null,
  result: null,

  setPhase: (phase) => set({ phase }),
  setSource: (source) => set({ source }),
  setConfig: (c) => set((s) => ({ config: { ...s.config, ...c } })),
  setPreChecks: (preChecks) => set({ preChecks }),
  setPreCheck: (id, status, detail) =>
    set((s) => ({
      preChecks: s.preChecks.map((c) => (c.id === id ? { ...c, status, detail: detail ?? c.detail } : c)),
    })),
  beginRun: (startedAt, expectedSamples) => set({ startedAt, expectedSamples, elapsedMs: 0 }),
  appendSample: (sample) => set((s) => ({ samples: [...s.samples, sample] })),
  setElapsed: (elapsedMs) => set({ elapsedMs }),
  setError: (error) => set({ error }),
  setResult: (result) => set({ result }),
  resetRuntime: () =>
    set({
      phase: 'idle',
      preChecks: [],
      samples: [],
      startedAt: null,
      elapsedMs: 0,
      expectedSamples: 0,
      error: null,
      result: null,
    }),
}))
