import type { Sample, TestConfig, TestStatus } from '@/types'
import { isStaleReading } from '@/services/validation'
import { DemoSampler, scenarioForBatteryId } from '@/services/demo/sampler'
import { buildRecord } from '@/services/records'
import { newTestId } from '@/lib/id'
import { useDeviceStore } from './deviceStore'
import { useHistoryStore } from './historyStore'
import { useCalibrationStore, isIdentityCalibration, describeCalibration } from './calibrationStore'
import { SAMPLE_INTERVAL_MS, useTestStore, type PreCheck } from './testStore'

const PRECHECK_STEP_MS = 420
const READY_HOLD_MS = 900
const PROCESSING_MS = 1400

const EMPTY_SAMPLE = (t: number): Sample => ({ t, voltage_v: null, current_a: null, temperature_c: null })

/**
 * Battery-test state machine: IDLE → PRE-CHECKS → READY → TESTING →
 * PROCESSING → RESULTS, plus ERROR. DISCONNECTED appears when a hardware
 * test is attempted without a device.
 *
 * Guarantees:
 * - duplicate starts are rejected;
 * - every timer is tracked and cleared on stop / completion / reset / unload;
 * - DEMO samples come from the labelled simulator only;
 * - HARDWARE samples only ever come from validated device readings — the
 *   engine never invents a measurement (missing ticks stay null);
 * - no physical load is ever actuated by any code path.
 */
class TestEngine {
  private timeouts = new Set<number>()
  private interval: number | null = null
  private sampler: DemoSampler | null = null
  private lastConsumedTs: string | null = null
  private testId = ''

  start(config: TestConfig): boolean {
    const t = useTestStore.getState()
    // Guard: reject accidental duplicate starts in any active phase.
    if (!['idle', 'error', 'results'].includes(t.phase)) return false

    const device = useDeviceStore.getState()
    const source = device.connection === 'connected' ? 'HARDWARE' : 'DEMO'

    t.resetRuntime()
    this.clearTimers()
    this.testId = newTestId()
    this.lastConsumedTs = null
    this.sampler =
      source === 'DEMO'
        ? new DemoSampler(
            config.chemistry,
            config.nominalVoltage,
            undefined,
            scenarioForBatteryId(config.batteryId),
          )
        : null

    t.setConfig(config)
    t.setSource(source)

    useDeviceStore.getState().pushEvent('info', `Test ${this.testId} started (${source} source).`)

    const checks: Array<{ id: string; label: string; run: () => { pass: boolean; detail: string } }> = []

    if (source === 'DEMO') {
      checks.push(
        {
          id: 'source',
          label: 'Data source',
          run: () => ({ pass: true, detail: 'DEMO DATA — simulated measurement model, not real hardware' }),
        },
        {
          id: 'timer',
          label: `Sampling timer (${(1000 / SAMPLE_INTERVAL_MS).toFixed(0)} Hz)`,
          run: () => ({ pass: true, detail: 'Timer available' }),
        },
        {
          id: 'storage',
          label: 'History storage',
          run: () => {
            const mode = useHistoryStore.getState().storageMode
            return {
              pass: true,
              detail:
                mode === 'local'
                  ? 'Browser local storage available'
                  : 'Browser storage unavailable — records kept in memory for this session only',
            }
          },
        },
        {
          id: 'safety',
          label: 'Physical load control',
          run: () => ({ pass: true, detail: 'Demo mode — no hardware is actuated by this website' }),
        },
      )
    } else {
      checks.push(
        {
          id: 'device',
          label: 'Device connection',
          run: () => {
            const d = useDeviceStore.getState()
            return d.connection === 'connected'
              ? { pass: true, detail: d.transportName ?? 'Connected' }
              : { pass: false, detail: 'Device is not connected' }
          },
        },
        {
          id: 'stream',
          label: 'Fresh validated readings',
          run: () => {
            const d = useDeviceStore.getState()
            if (d.lastReading && d.lastValidAt && !isStaleReading(d.lastValidAt, 10_000)) {
              return { pass: true, detail: 'Validated payload stream is live' }
            }
            return { pass: false, detail: 'No fresh validated reading — start the device measurement stream first' }
          },
        },
        {
          id: 'integrity',
          label: 'Measurement integrity',
          run: () => {
            const d = useDeviceStore.getState()
            return d.invalidCount === 0
              ? { pass: true, detail: 'No rejected payloads so far' }
              : { pass: false, detail: `${d.invalidCount} payload(s) failed validation — check the event log` }
          },
        },
      )
    }

    t.setPreChecks(checks.map<PreCheck>((c) => ({ id: c.id, label: c.label, status: 'pending' })))
    t.setPhase('pre-checks')

    checks.forEach((check, i) => {
      this.after(PRECHECK_STEP_MS * (i + 1), () => {
        const store = useTestStore.getState()
        if (store.phase !== 'pre-checks') return
        store.setPreCheck(check.id, 'running')
        const { pass, detail } = check.run()
        this.after(PRECHECK_STEP_MS / 2, () => {
          const s2 = useTestStore.getState()
          if (s2.phase !== 'pre-checks') return
          s2.setPreCheck(check.id, pass ? 'pass' : 'fail', detail)
          if (!pass) {
            this.clearTimers()
            s2.setError(`Pre-check failed — ${check.label}: ${detail}`)
            s2.setPhase(source === 'DEMO' ? 'error' : 'disconnected')
            useDeviceStore.getState().pushEvent('error', `Test aborted at pre-checks: ${detail}`)
          }
        })
      })
    })

    this.after(PRECHECK_STEP_MS * checks.length + 300, () => {
      const store = useTestStore.getState()
      if (store.phase !== 'pre-checks') return
      store.setPhase('ready')
      useDeviceStore.getState().pushEvent('info', 'Pre-checks passed — system ready.')
    })

    this.after(PRECHECK_STEP_MS * checks.length + 300 + READY_HOLD_MS, () => {
      const store = useTestStore.getState()
      if (store.phase !== 'ready') return
      this.beginRun()
    })

    return true
  }

  private beginRun(): void {
    const t = useTestStore.getState()
    const startedAt = Date.now()
    const expectedSamples = Math.round((t.config.durationS * 1000) / SAMPLE_INTERVAL_MS)
    t.beginRun(startedAt, expectedSamples)
    t.setPhase('testing')
    this.tick()
    this.interval = window.setInterval(() => this.tick(), SAMPLE_INTERVAL_MS)
  }

  private tick(): void {
    const t = useTestStore.getState()
    if (t.phase !== 'testing' || t.startedAt === null) return
    const elapsed = Date.now() - t.startedAt
    if (elapsed >= t.config.durationS * 1000) {
      this.complete('completed')
      return
    }
    t.setElapsed(elapsed)
    const time = t.samples.length * SAMPLE_INTERVAL_MS
    const sample = t.source === 'DEMO' ? this.demoSample(time) : this.hardwareSample(time)
    t.appendSample(sample)
  }

  private demoSample(time: number): Sample {
    const values = this.sampler?.next(time / 1000)
    if (!values) return EMPTY_SAMPLE(time)
    useDeviceStore.getState().noteDemoReading(values)
    return { t: time, ...values }
  }

  private hardwareSample(time: number): Sample {
    const dev = useDeviceStore.getState()
    const r = dev.lastReading
    // Only real, validated, fresh readings are recorded. No fabrication.
    if (r && dev.lastValidAt === r.timestamp && !isStaleReading(r.timestamp, 10_000)) {
      if (this.lastConsumedTs !== r.timestamp) {
        this.lastConsumedTs = r.timestamp
        return { t: time, voltage_v: r.voltage_v, current_a: r.current_a, temperature_c: r.temperature_c }
      }
    }
    return EMPTY_SAMPLE(time)
  }

  /** User pressed Stop. Finalizes partial data if any samples exist. */
  stop(): boolean {
    const t = useTestStore.getState()
    if (!['pre-checks', 'ready', 'testing'].includes(t.phase)) return false
    this.clearTimers()
    if (t.phase === 'testing' && t.samples.length > 0) {
      useDeviceStore.getState().pushEvent('warn', `Test ${this.testId} stopped by user at ${t.samples.length} samples.`)
      this.complete('stopped')
    } else {
      useDeviceStore.getState().pushEvent('info', `Test ${this.testId} stopped before sampling produced data.`)
      t.resetRuntime()
    }
    return true
  }

  reset(): void {
    this.clearTimers()
    useTestStore.getState().resetRuntime()
    useDeviceStore.getState().pushEvent('info', 'Test reset.')
  }

  private complete(status: TestStatus): void {
    this.clearTimers()
    const t = useTestStore.getState()
    t.setPhase('processing')
    useDeviceStore.getState().pushEvent('info', 'Sampling finished — processing measurements…')

    this.after(PROCESSING_MS, () => {
      const s = useTestStore.getState()
      const endedAt = Date.now()
      const record = buildRecord({
        id: this.testId,
        startedAt: s.startedAt ?? endedAt,
        endedAt,
        status,
        source: s.source,
        config: s.config,
        sampleIntervalMs: SAMPLE_INTERVAL_MS,
        expectedSamples: s.expectedSamples,
        samples: s.samples,
      })
      // Provenance: hardware tests recorded while sensor calibration was
      // active say so in the report, so numbers are never silently adjusted.
      if (record.source === 'HARDWARE') {
        const cal = useCalibrationStore.getState().sensor
        if (!isIdentityCalibration(cal)) {
          record.warnings.push(
            `Readings passed through user-entered sensor calibration (${describeCalibration(cal)}) — see Settings → Calibration. Raw device values were NOT stored.`,
          )
        }
      }
      useHistoryStore.getState().addRecord(record)
      s.setResult(record)
      s.setPhase('results')
      useDeviceStore.getState().pushEvent(
        'info',
        `Test ${record.id} ${status} — ${record.samples.length} samples, completeness ${(record.completeness * 100).toFixed(1)}%.`,
      )
    })
  }

  private after(ms: number, fn: () => void): void {
    const id = window.setTimeout(() => {
      this.timeouts.delete(id)
      fn()
    }, ms)
    this.timeouts.add(id)
  }

  private clearTimers(): void {
    if (this.interval !== null) {
      window.clearInterval(this.interval)
      this.interval = null
    }
    for (const id of this.timeouts) window.clearTimeout(id)
    this.timeouts.clear()
  }

  /** Called on app unload so no timers survive the page. */
  dispose(): void {
    this.clearTimers()
  }
}

export const testEngine = new TestEngine()
