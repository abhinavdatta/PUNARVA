import { useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  BatteryCharging,
  CheckCircle2,
  Cpu,
  Gauge,
  Thermometer,
  TriangleAlert,
  Zap,
} from 'lucide-react'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useDeviceStore, selectCurrentSource } from '@/state/deviceStore'
import { useTestStore } from '@/state/testStore'
import { useHistoryStore } from '@/state/historyStore'
import { useMotionEnabled } from '@/state/useMotionEnabled'
import { fmtNum, fmtPct, relativeTime } from '@/lib/format'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { RecentTests } from '@/components/dashboard/RecentTests'
import { ConnectionPanel } from '@/components/dashboard/ConnectionPanel'
import { EventLog } from '@/components/dashboard/EventLog'
import { ChartCard } from '@/components/charts/ChartCard'
import { BatteryTesterVisual } from '@/components/three/BatteryTesterScene'

export function OverviewPage() {
  const motionEnabled = useMotionEnabled()
  const controlsRef = useRef<OrbitControlsImpl>(null)

  const connection = useDeviceStore((s) => s.connection)
  const source = useDeviceStore(selectCurrentSource)
  const lastReading = useDeviceStore((s) => s.lastReading)
  const lastValidAt = useDeviceStore((s) => s.lastValidAt)
  const lastReadingSource = useDeviceStore((s) => s.lastReadingSource)

  const phase = useTestStore((s) => s.phase)
  const samples = useTestStore((s) => s.samples)
  const expectedSamples = useTestStore((s) => s.expectedSamples)
  const testSource = useTestStore((s) => s.source)
  const result = useTestStore((s) => s.result)

  const records = useHistoryStore((s) => s.records)

  const testing = phase === 'testing' || phase === 'processing'

  /** The dataset the charts/metrics reflect: live test → stored result → last history record. */
  const dataset = useMemo(() => {
    if (phase === 'testing' || phase === 'processing') return { samples, source: testSource, label: 'Live test data' }
    if (result) return { samples: result.samples, source: result.source, label: 'Last test result' }
    const last = records[0]
    if (last) return { samples: last.samples, source: last.source, label: 'Most recent recorded test' }
    return null
  }, [phase, samples, testSource, result, records])

  const waveform = useMemo(() => {
    const vals = dataset?.samples
      .slice(-60)
      .map((s) => s.voltage_v)
      .filter((v): v is number => v !== null) ?? []
    if (vals.length < 2) return []
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const span = max - min || 1
    return vals.map((v) => (v - min) / span)
  }, [dataset])

  const liveCompleteness = useMemo(() => {
    if (!testing || expectedSamples === 0) return null
    const valid = samples.filter((s) => s.voltage_v !== null || s.current_a !== null || s.temperature_c !== null).length
    return { ratio: valid / expectedSamples, valid, expected: expectedSamples }
  }, [testing, samples, expectedSamples])

  const qualityDataset = liveCompleteness ?? (result ? { ratio: result.completeness, valid: result.samples.length, expected: result.expectedSamples } : null)

  const metricFreshness = lastValidAt ? relativeTime(lastValidAt) : undefined
  const liveSourceLabel = lastReading
    ? lastReadingSource === 'DEMO'
      ? 'Simulated (demo)'
      : 'Hardware reading'
    : connection === 'connected'
      ? 'Waiting for valid payload'
      : 'No live device'

  return (
    <div className="space-y-8">
      {/* ============================ HERO ============================ */}
      <section className="hero-radial tech-grid panel relative overflow-hidden">
        <div className="grid lg:grid-cols-2">
          <div className="relative z-10 flex flex-col justify-center gap-5 p-6 sm:p-10">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="copper">Engineering prototype</Badge>
              <Badge tone="amber">Demo data until hardware is connected</Badge>
            </div>
            <div>
              <p className="font-display text-sm font-bold uppercase tracking-[0.3em] text-copper-400">PUNARVA</p>
              <h2 className="mt-2 font-display text-3xl font-bold leading-tight tracking-tight text-ivory sm:text-4xl">
                Know your battery.
                <br />
                <span className="bg-gradient-to-r from-copper-400 to-sea-400 bg-clip-text text-transparent">Before it fails.</span>
              </h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-lavender sm:text-base">
                Every battery has more life. PUNARVA measures electrical response, records test data, and turns it
                into transparent reports for smarter battery lifecycle decisions.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link to="/battery-check">
                <Button variant="primary" size="lg">
                  <Activity className="h-5 w-5" aria-hidden /> Start battery test
                </Button>
              </Link>
              <Link to="/technology">
                <Button variant="secondary" size="lg">
                  <Cpu className="h-5 w-5" aria-hidden /> Explore technology
                </Button>
              </Link>
            </div>
            <p className="text-[11px] leading-relaxed text-lavender/60">
              Conceptual prototype visualization — the 3D model is illustrative, not a manufacturing-accurate CAD
              model. Drag to orbit the scene.
            </p>
          </div>

          <div className="relative min-h-[340px] lg:min-h-[480px]">
            <BatteryTesterVisual
              testing={testing}
              progress={dataset?.samples.length && expectedSamples ? dataset.samples.length / expectedSamples : 0}
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
                <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" aria-hidden /> Demo test running
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ======================== METRIC CARDS ======================== */}
      <section>
        <SectionHeading
          eyebrow="Live measurements"
          title="Battery vitals"
          description="Values appear here only from a running test or a connected, validated device — never invented."
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={<Zap aria-hidden />}
            title="Voltage"
            value={lastReading ? fmtNum(lastReading.voltage_v, 2) : '—'}
            unit="V"
            sourceLabel={liveSourceLabel}
            sourceTone={lastReading ? (lastReadingSource === 'DEMO' ? 'amber' : 'teal') : 'grey'}
            freshness={lastReading ? metricFreshness : undefined}
            status={testing ? { tone: 'amber', label: 'Demo live', pulse: true } : { tone: connection === 'connected' ? 'teal' : 'grey', label: connection === 'connected' ? 'Hardware' : 'Standby' }}
          />
          <MetricCard
            icon={<Gauge aria-hidden />}
            title="Current"
            value={lastReading ? fmtNum(lastReading.current_a, 2) : '—'}
            unit="A"
            sourceLabel={liveSourceLabel}
            sourceTone={lastReading ? (lastReadingSource === 'DEMO' ? 'amber' : 'teal') : 'grey'}
            freshness={lastReading ? metricFreshness : undefined}
            status={testing ? { tone: 'amber', label: 'Demo live', pulse: true } : { tone: connection === 'connected' ? 'teal' : 'grey', label: connection === 'connected' ? 'Hardware' : 'Standby' }}
          />
          <MetricCard
            icon={<Thermometer aria-hidden />}
            title="Temperature"
            value={lastReading ? fmtNum(lastReading.temperature_c, 1) : '—'}
            unit="°C"
            sourceLabel={liveSourceLabel}
            sourceTone={lastReading ? (lastReadingSource === 'DEMO' ? 'amber' : 'teal') : 'grey'}
            freshness={lastReading ? metricFreshness : undefined}
            status={testing ? { tone: 'amber', label: 'Demo live', pulse: true } : { tone: connection === 'connected' ? 'teal' : 'grey', label: connection === 'connected' ? 'Hardware' : 'Standby' }}
          />
          <MetricCard
            icon={<CheckCircle2 aria-hidden />}
            title="Data quality"
            value={qualityDataset ? fmtPct(qualityDataset.ratio, 1) : '—'}
            sourceLabel={qualityDataset ? 'Sample completeness' : 'No test data'}
            sourceTone={qualityDataset ? 'teal' : 'grey'}
            status={{ tone: qualityDataset ? (qualityDataset.ratio >= 0.95 ? 'teal' : 'amber') : 'grey', label: qualityDataset ? 'Measured' : 'Awaiting' }}
            footer={
              qualityDataset ? (
                <p className="numeric text-[11px] text-lavender/70">
                  {qualityDataset.valid} of {qualityDataset.expected} expected samples contained valid measurements.
                </p>
              ) : (
                <p className="text-[11px] text-lavender/70">Run a test to measure completeness and validity.</p>
              )
            }
          />
        </div>
      </section>

      {/* =========================== CHARTS =========================== */}
      <section>
        <SectionHeading
          eyebrow="Electrical response"
          title="Measurement trends"
          description={dataset ? `Showing: ${dataset.label}.` : 'No measurement data yet — start a test to populate these charts.'}
          actions={
            <Link to="/battery-check">
              <Button variant="secondary" size="sm">
                <BatteryCharging className="h-4 w-4" aria-hidden /> Run a test
              </Button>
            </Link>
          }
        />
        {dataset ? (
          <div className="grid gap-5 xl:grid-cols-3">
            <ChartCard title="Voltage response" channel="voltage_v" samples={dataset.samples} source={dataset.source} />
            <ChartCard title="Current trend" channel="current_a" samples={dataset.samples} source={dataset.source} />
            <ChartCard title="Temperature trend" channel="temperature_c" samples={dataset.samples} source={dataset.source} />
          </div>
        ) : (
          <Card>
            <CardBody>
              <div className="tech-grid flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-plum-500/60 px-6 py-14 text-center">
                <TriangleAlert className="h-6 w-6 text-lavender/60" aria-hidden />
                <p className="text-sm font-medium text-ivory">Charts are empty until a test provides data</p>
                <p className="max-w-md text-xs leading-relaxed text-lavender/70">
                  PUNARVA does not fabricate readings. Voltage, current, and temperature charts populate from your
                  test runs or from imported device logs.
                </p>
                <Link to="/battery-check" className="mt-1">
                  <Button variant="primary" size="sm">
                    <Activity className="h-4 w-4" aria-hidden /> Start a demo test
                  </Button>
                </Link>
              </div>
            </CardBody>
          </Card>
        )}
      </section>

      {/* ===================== BOTTOM DASHBOARD ======================= */}
      <section className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent battery tests"
            icon={<Activity aria-hidden />}
            actions={
              <Link to="/history" className="inline-flex items-center gap-1 text-xs font-medium text-sea-400 hover:text-sea-300">
                View all <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            }
          />
          <CardBody className="p-0">
            <RecentTests records={records} />
          </CardBody>
        </Card>
        <ConnectionPanel compact />
      </section>

      <EventLog limit={10} />
    </div>
  )
}
