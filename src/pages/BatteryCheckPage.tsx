import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, AlertTriangle, Eye, Play, RotateCcw, Square } from 'lucide-react'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { TestConfig, TestDurationS } from '@/types'
import { testEngine } from '@/state/testEngine'
import { useTestStore } from '@/state/testStore'
import { useDeviceStore, selectCurrentSource } from '@/state/deviceStore'
import { useMotionEnabled } from '@/state/useMotionEnabled'
import { fmtClock, fmtNum, relativeTime } from '@/lib/format'
import { CHEMISTRIES } from '@/data/chemistry'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { SelectField, TextField } from '@/components/ui/fields'
function NoopSourceBanner() {
  return null
}
import { PhaseTimeline, PreCheckList } from '@/components/battery/PhaseTimeline'
import { ChartCard } from '@/components/charts/ChartCard'
import { ResultsReport } from '@/components/results/ResultsReport'
import { BatteryTesterVisual } from '@/components/three/BatteryTesterScene'

const DURATIONS: Array<{ value: TestDurationS; label: string }> = [
  { value: 15, label: '15 s' },
  { value: 30, label: '30 s' },
  { value: 60, label: '60 s' },
  { value: 120, label: '2 min' },
]

export function BatteryCheckPage() {
  const motionEnabled = useMotionEnabled()
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const reportRef = useRef<HTMLDivElement>(null)

  const phase = useTestStore((s) => s.phase)
  const source = useTestStore((s) => s.source)
  const config = useTestStore((s) => s.config)
  const preChecks = useTestStore((s) => s.preChecks)
  const samples = useTestStore((s) => s.samples)
  const elapsedMs = useTestStore((s) => s.elapsedMs)
  const expectedSamples = useTestStore((s) => s.expectedSamples)
  const error = useTestStore((s) => s.error)
  const result = useTestStore((s) => s.result)

  const currentSource = useDeviceStore(selectCurrentSource)
  void currentSource
  const lastReading = useDeviceStore((s) => s.lastReading)
  const lastValidAt = useDeviceStore((s) => s.lastValidAt)

  // Local form strings (numeric inputs stay editable and are parsed on start)
  const [batteryId, setBatteryId] = useState('')
  const [nominalV, setNominalV] = useState('')
  const [capacityAh, setCapacityAh] = useState('')
  const [duration, setDuration] = useState<TestDurationS>(30)
  // Mirror for same-tick reads: a Start click that follows a duration change
  // in the same task must never see a stale duration.
  const durationRef = useRef<TestDurationS>(30)
  const setDurationSync = (d: TestDurationS) => {
    durationRef.current = d
    setDuration(d)
  }

  const active = phase === 'pre-checks' || phase === 'ready' || phase === 'testing' || phase === 'processing'
  const testing = phase === 'testing'
  const inputsDisabled = active

  const durationMs = duration * 1000
  const progress = testing || phase === 'processing' ? Math.min(1, elapsedMs / durationMs) : phase === 'results' ? 1 : 0
  const remainingS = Math.max(0, (durationMs - elapsedMs) / 1000)

  // Auto-scroll to the report once results are ready
  useEffect(() => {
    if (phase === 'results' && result) {
      const t = window.setTimeout(() => reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
      return () => window.clearTimeout(t)
    }
  }, [phase, result])

  const waveform = useMemo(() => {
    const vals = samples.slice(-60).map((s) => s.voltage_v).filter((v): v is number => v !== null)
    if (vals.length < 2) return []
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const span = max - min || 1
    return vals.map((v) => (v - min) / span)
  }, [samples])

  function parseOptional(v: string): number | null | 'invalid' {
    const s = v.trim()
    if (s === '') return null
    const n = Number(s)
    return Number.isFinite(n) && n > 0 ? n : 'invalid'
  }

  function onStart() {
    const nv = parseOptional(nominalV)
    const ca = parseOptional(capacityAh)
    if (nv === 'invalid' || ca === 'invalid') {
      useTestStore.getState().setError('Nominal voltage and rated capacity must be positive numbers (or left blank).')
      useTestStore.getState().setPhase('error')
      return
    }
    const next: TestConfig = {
      batteryId: batteryId.trim() || 'Unnamed battery',
      chemistry: config.chemistry,
      nominalVoltage: nv === null ? null : nv,
      ratedCapacityAh: ca === null ? null : ca,
      durationS: durationRef.current,
    }
    testEngine.start(next)
  }

  return (
    <div className="space-y-6">
      <NoopSourceBanner />

      {/* Error / disconnected states */}
      {(phase === 'error' || phase === 'disconnected') && (
        <div className="flex items-start gap-3 rounded-xl border border-critical-500/40 bg-critical-500/10 px-4 py-3.5" role="alert">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-critical-400" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-critical-400">{phase === 'error' ? 'Test error' : 'Device disconnected'}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-lavender/85">{error ?? 'The test was aborted.'}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => testEngine.reset()}>
            <RotateCcw className="h-4 w-4" aria-hidden /> Reset
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* ------------------------- Setup ------------------------- */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Test setup"
              icon={<Activity aria-hidden />}
              subtitle={inputsDisabled ? 'Locked while a test is running' : 'All fields except chemistry are optional'}
            />
            <CardBody className="space-y-4">
              <TextField
                label="Battery identification"
                placeholder="e.g. BATT-001, drill pack, UPS cell…"
                value={batteryId}
                onChange={(e) => setBatteryId(e.target.value)}
                disabled={inputsDisabled}
              />
              <SelectField
                label="Chemistry / type"
                value={config.chemistry}
                onChange={(e) => useTestStore.getState().setConfig({ chemistry: e.target.value })}
                disabled={inputsDisabled}
              >
                {CHEMISTRIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </SelectField>
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  label="Nominal voltage"
                  unit="V"
                  inputMode="decimal"
                  placeholder="optional"
                  value={nominalV}
                  onChange={(e) => setNominalV(e.target.value)}
                  disabled={inputsDisabled}
                />
                <TextField
                  label="Rated capacity"
                  unit="Ah"
                  inputMode="decimal"
                  placeholder="optional"
                  value={capacityAh}
                  onChange={(e) => setCapacityAh(e.target.value)}
                  disabled={inputsDisabled}
                />
              </div>

              <div>
                <p className="mb-1.5 text-xs font-medium text-lavender">Test duration</p>
                <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Test duration">
                  {DURATIONS.map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      role="radio"
                      aria-checked={duration === d.value}
                      disabled={inputsDisabled}
                      onClick={() => setDurationSync(d.value)}
                      className={
                        'h-9 rounded-lg border text-xs font-semibold transition-colors disabled:opacity-50 ' +
                        (duration === d.value
                          ? 'border-copper-500/70 bg-copper-500/15 text-copper-400'
                          : 'border-plum-500/70 bg-plum-800/60 text-lavender hover:text-ivory')
                      }
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Controls */}
              <div className="flex flex-wrap gap-2 border-t border-plum-600/50 pt-4">
                <Button
                  variant="primary"
                  onClick={onStart}
                  disabled={active}
                  title={active ? 'A test is already running' : 'Start the test'}
                >
                  <Play className="h-4 w-4" aria-hidden />
                  {active ? 'Test running…' : 'Start Test'}
                </Button>
                <Button variant="danger" onClick={() => testEngine.stop()} disabled={!active}>
                  <Square className="h-4 w-4" aria-hidden /> Stop Test
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => testEngine.reset()}
                  disabled={phase === 'idle'}
                >
                  <RotateCcw className="h-4 w-4" aria-hidden /> Reset
                </Button>
                {result && (
                  <Button variant="teal" onClick={() => reportRef.current?.scrollIntoView({ behavior: 'smooth' })}>
                    <Eye className="h-4 w-4" aria-hidden /> View Results
                  </Button>
                )}
              </div>
              <p className="text-[11px] leading-relaxed text-lavender/60">
                Starting a test never actuates physical hardware. The demo generator is clearly labelled; real
                measurements require a connected, validated device stream.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Pre-test checks" icon={<Activity aria-hidden />} />
            <CardBody className="pt-4">
              <PreCheckList checks={preChecks} />
            </CardBody>
          </Card>
        </div>

        {/* --------------------- Visualization --------------------- */}
        <div className="space-y-6 lg:col-span-3">
          <Card className="overflow-hidden">
            <div className="relative h-[300px] sm:h-[380px]">
              <BatteryTesterVisual
                compact
                testing={testing}
                progress={progress}
                reading={testing ? lastReading : null}
                demo={source === 'DEMO'}
                waveform={waveform}
                motionEnabled={motionEnabled}
                controlsRef={controlsRef}
              />
              <button
                type="button"
                onClick={() => controlsRef.current?.reset()}
                className="absolute right-3 top-3 rounded-lg border border-plum-500/60 bg-plum-900/80 px-2.5 py-1.5 text-[11px] font-medium text-lavender backdrop-blur transition-colors hover:text-ivory"
              >
                Reset view
              </button>
              {testing && (
                <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-plum-900/85 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-400 backdrop-blur">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" aria-hidden /> Scanning
                </span>
              )}
            </div>
            <p className="border-t border-plum-600/50 px-4 py-2.5 text-[11px] text-lavender/60">
              Conceptual prototype visualization — drag to orbit. The scanning ring animates during a demo test only.
            </p>
          </Card>

          <Card>
            <CardHeader
              title="Test progress"
              icon={<Activity aria-hidden />}
              actions={
                <div className="flex items-center gap-2">
                  <Badge tone={source === 'DEMO' ? 'amber' : 'teal'}>{source}</Badge>
                  {lastValidAt && (
                    <span className="numeric text-[11px] text-lavender/60">last sample {relativeTime(lastValidAt)}</span>
                  )}
                </div>
              }
            />
            <CardBody className="space-y-4">
              <PhaseTimeline phase={phase} />
              {(active || phase === 'results') && (
                <>
                  <ProgressBar value={progress} label="Test progress" tone={source === 'DEMO' ? 'copper' : 'teal'} />
                  <div className="grid grid-cols-3 gap-3 text-center">
                    {(
                      [
                        ['Elapsed', fmtClock(elapsedMs / 1000)],
                        ['Remaining', phase === 'results' ? '00:00' : fmtClock(remainingS)],
                        ['Samples', `${samples.length}${expectedSamples ? ` / ${expectedSamples}` : ''}`],
                      ] as const
                    ).map(([k, v]) => (
                      <div key={k} className="rounded-lg border border-plum-600/60 bg-plum-800/40 px-2 py-2.5">
                        <p className="text-[10px] uppercase tracking-wider text-lavender/60">{k}</p>
                        <p className="numeric mt-0.5 font-display text-lg font-bold text-ivory">{v}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {testing && lastReading && (
                <div className="grid grid-cols-3 gap-3 text-center">
                  {(
                    [
                      ['Voltage', `${fmtNum(lastReading.voltage_v, 2)} V`, 'text-sea-300'],
                      ['Current', `${fmtNum(lastReading.current_a, 2)} A`, 'text-copper-400'],
                      ['Temp', `${fmtNum(lastReading.temperature_c, 1)} °C`, 'text-amber-400'],
                    ] as const
                  ).map(([k, v, tone]) => (
                    <div key={k} className="rounded-lg border border-plum-600/60 bg-plum-800/40 px-2 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-lavender/60">{k}</p>
                      <p className={`numeric mt-0.5 font-display text-base font-bold ${tone}`}>{v}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* ------------------------- Charts ------------------------- */}
      <section>
        <div className="grid gap-5 xl:grid-cols-3">
          <ChartCard
            title="Voltage response"
            channel="voltage_v"
            samples={samples}
            source={samples.length > 0 ? source : null}
          />
          <ChartCard
            title="Current trend"
            channel="current_a"
            samples={samples}
            source={samples.length > 0 ? source : null}
          />
          <ChartCard
            title="Temperature trend"
            channel="temperature_c"
            samples={samples}
            source={samples.length > 0 ? source : null}
          />
        </div>
      </section>

      {/* ------------------------- Results ------------------------- */}
      {phase === 'results' && result && (
        <section ref={reportRef} className="scroll-mt-24">
          <ResultsReport record={result} />
          <p className="mt-4 text-center text-xs text-lavender/60">
            This report is also saved in{' '}
            <Link to="/history" className="text-sea-400 hover:text-sea-300">
              Test History
            </Link>
            .
          </p>
        </section>
      )}
    </div>
  )
}
