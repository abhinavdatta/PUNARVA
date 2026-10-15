import { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Microscope } from 'lucide-react'
import { useDeviceStore } from '@/state/deviceStore'
import { useTestStore } from '@/state/testStore'
import { useCalibrationStore, isIdentityCalibration, describeCalibration } from '@/state/calibrationStore'
import { browserSupportSummary } from '@/services/device/transports'
import { screenRecord } from '@/services/screening'
import { testEngine } from '@/state/testEngine'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

export function TestPage() {
  const location = useLocation()
  const device = useDeviceStore()
  const testStore = useTestStore()
  const calStore = useCalibrationStore()

  const source = testStore.source
  const phase = testStore.phase
  const config = testStore.config
  const preChecks = testStore.preChecks
  const samples = testStore.samples
  const result = testStore.result

  const testEngineRunning =
    phase === 'pre-checks' || phase === 'ready' || phase === 'testing' || phase === 'processing'

  // Screen the last result if we have one
  const screening = result ? screenRecord(result) : null

  const support = browserSupportSummary()

  // Compute per-component status
  const components = useMemo(
    () => [
      {
        id: 'browser-support',
        label: 'Browser Support',
        kind: 'info',
        status:
          support.webSerial && support.webGL && support.localStorage
            ? 'pass'
            : 'warning',
        detail: [
          support.webSerial ? 'Web Serial: available' : 'Web Serial: unavailable (mobile or Safari)',
          support.webGL ? 'WebGL: available' : 'WebGL: unavailable',
          support.localStorage ? 'localStorage: available' : 'localStorage: unavailable',
        ].join(' · '),
      },
      {
        id: 'device-connection',
        label: 'Device Connection',
        kind: 'info',
        status:
          device.connection === 'connected'
            ? 'pass'
            : device.connection === 'connecting'
            ? 'running'
            : 'warning',
        detail: device.transportName
          ? `Connected via ${device.transportName}`
          : device.connection === 'disconnected'
          ? 'No device connected'
          : 'Connecting…',
      },
      {
        id: 'test-engine',
        label: 'Test Engine',
        kind: 'info',
        status: testEngineRunning ? 'running' : 'idle',
        detail: testEngineRunning ? `Phase: ${phase}` : `Source: ${source}`,
      },
      {
        id: 'pre-checks',
        label: 'Pre-checks',
        kind: 'info',
        status: preChecks.length > 0 ? 'pending' : 'none',
        detail: preChecks.length > 0
          ? preChecks.map((c) => `${c.id}: ${c.status}`).join(' | ')
          : 'No pre-checks have run yet',
      },
      {
        id: 'samples',
        label: 'Samples',
        kind: 'info',
        status: samples.length > 0 ? 'collected' : 'none',
        detail: `${samples.length} samples collected${config.durationS ? ` (${config.durationS}s duration)` : ''}`,
      },
      {
        id: 'results',
        label: 'Results',
        kind: 'info',
        status: result ? 'available' : 'none',
        detail: result ? `${result.completeness * 100}% complete — ${result.status}` : 'No test completed yet',
      },
      {
        id: 'calibration',
        label: 'Calibration',
        kind: 'info',
        status: isIdentityCalibration(calStore.sensor) ? 'identity' : 'active',
        detail: isIdentityCalibration(calStore.sensor)
          ? 'No corrections applied'
          : `Active: ${describeCalibration(calStore.sensor)}`,
      },
      {
        id: 'screening',
        label: 'Screening Outcome',
        kind: 'result',
        status:
          screening &&
          (screening.result === 'RECYCLE'
            ? 'red'
            : screening.result === 'INSPECT'
            ? 'amber'
            : 'pass'),
        detail: screening
          ? `${screening.result}: ${screening.reasons.join(' · ')}`
          : 'No screening has been applied',
      },
    ],
    [
      support,
      device,
      testStore,
      calStore,
      config.durationS,
      phase,
      preChecks,
      result,
      screening,
      samples.length,
      source,
      testEngineRunning,
    ]
  )

  return (
    <div className="min-h-screen p-6 lg:p-8">
      <nav className="mb-6">
        <Link to="/" className="text-lavender hover:text-sea-300">
          ← Back to dashboard
        </Link>
        <span className="ml-4 text-xs text-lavender/60">
          {location.pathname}
        </span>
      </nav>

      <Card>
        <CardHeader title="Component Diagnosis" icon={<Microscope />} subtitle={location.pathname.slice(1)} />
        <CardBody className="space-y-4">
          {components.map((comp) => (
            <div
              key={comp.id}
              className={cn(
                'rounded-lg border px-4 py-3',
                comp.status === 'pass'
                  ? 'border-sea-400/40 bg-sea-400/8'
                  : comp.status === 'warning'
                  ? 'border-amber-500/50 bg-amber-500/10'
                  : comp.status === 'critical'
                  ? 'border-critical-500/50 bg-critical-500/10'
                  : 'border-plum-500/60 bg-plum-800/50',
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Microscope className="h-4 w-4 text-lavender/50" aria-hidden />
                  <span className="text-sm font-medium text-ivory">{comp.label}</span>
                </div>
                <Badge tone={
                  comp.status === 'pass'
                    ? 'teal'
                    : comp.status === 'warning'
                    ? 'amber'
                    : comp.status === 'critical'
                    ? 'red'
                    : 'neutral'
                }>
                  {comp.status}
                </Badge>
              </div>
              {comp.detail && (
                <p className="mt-1 text-[11px] leading-relaxed text-lavender/70">{comp.detail}</p>
              )}
            </div>
          ))}

          {/* Action buttons for common tests */}
          {testEngineRunning ? (
            <Button
              variant="secondary"
              onClick={() => {
                testEngine.stop()
                useDeviceStore.getState().pushEvent('info', 'Test stopped from diagnosis page.')
              }}
            >
              <span className="h-4 w-4" aria-hidden /> Stop Test
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={() => {
                testEngine.start({
                  batteryId: 'test-good',
                  chemistry: 'li-ion',
                  nominalVoltage: 3.7,
                  ratedCapacityAh: null,
                  durationS: 15,
                })
                useDeviceStore.getState().pushEvent('info', '15s demo test started from diagnosis page.')
              }}
            >
              <span className="h-4 w-4" aria-hidden /> 15s Demo Test
            </Button>
          )}

          <Button variant="ghost" onClick={() => window.scrollTo(0, 0)}>
            ↟ Scroll to top
          </Button>
        </CardBody>
      </Card>

      <footer className="mt-8 text-xs text-lavender/60">
        Diagnosed at{(new Date()).toLocaleTimeString()} ·{' '}
        PUNARVA v{"0.1.0"} • <Link to="/" className="hover:text-sea-300">dashboard</Link>
      </footer>
    </div>
  )
}