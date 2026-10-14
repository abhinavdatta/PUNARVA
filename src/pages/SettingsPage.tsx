import { useState } from 'react'
import { Cable, Database, Eye, HardDrive, Monitor, Ruler, ShieldCheck, Trash2 } from 'lucide-react'
import { useDeviceStore } from '@/state/deviceStore'
import { useHistoryStore } from '@/state/historyStore'
import { useSettingsStore, type MotionPreference } from '@/state/settingsStore'
import { browserSupportSummary } from '@/services/device/transports'
import { EXAMPLE_PAYLOAD } from '@/services/validation'
import { storageBytes } from '@/services/storage/safeStorage'
import { fmtBytes } from '@/lib/format'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { CodeBlock } from '@/components/ui/CodeBlock'
import { Modal } from '@/components/ui/Modal'
import {
  useCalibrationStore,
  IDENTITY_CALIBRATION,
  isIdentityCalibration,
  describeCalibration,
  type ChannelCalibration,
  type SensorCalibration,
} from '@/state/calibrationStore'
import { cn } from '@/lib/utils'

const MOTION_OPTIONS: Array<{ id: MotionPreference; label: string; note: string }> = [
  { id: 'system', label: 'Follow system', note: 'Respect the OS "reduce motion" setting' },
  { id: 'full', label: 'Full motion', note: 'Always animate (3D orbit, scanning, charts)' },
  { id: 'reduced', label: 'Reduced', note: 'Minimise animation for comfort and performance' },
]

export function SettingsPage() {
  const connection = useDeviceStore((s) => s.connection)
  const connectionError = useDeviceStore((s) => s.connectionError)
  const serialSupported = useDeviceStore((s) => s.serialSupported)
  const transportName = useDeviceStore((s) => s.transportName)
  const invalidCount = useDeviceStore((s) => s.invalidCount)
  const connectDevice = useDeviceStore((s) => s.connectDevice)
  const disconnectSerial = useDeviceStore((s) => s.disconnectSerial)
  const transportKind = useDeviceStore((s) => s.transportKind)
  const setTransportKind = useDeviceStore((s) => s.setTransportKind)
  const websocketUrl = useDeviceStore((s) => s.websocketUrl)
  const setWebsocketUrl = useDeviceStore((s) => s.setWebsocketUrl)
  const pushEvent = useDeviceStore((s) => s.pushEvent)

  const motionOverride = useSettingsStore((s) => s.motionOverride)
  const setMotionOverride = useSettingsStore((s) => s.setMotionOverride)

  const records = useHistoryStore((s) => s.records)
  const storageMode = useHistoryStore((s) => s.storageMode)
  const clearAll = useHistoryStore((s) => s.clearAll)

  const sensorCal = useCalibrationStore((s) => s.sensor)
  const setSensorCal = useCalibrationStore((s) => s.setSensor)
  const resetSensorCal = useCalibrationStore((s) => s.resetSensor)

  const [confirmClear, setConfirmClear] = useState(false)
  const [calDraft, setCalDraft] = useState<SensorCalibration>(sensorCal)
  const support = browserSupportSummary()

  const calDirty = JSON.stringify(calDraft) !== JSON.stringify(sensorCal)
  const calIdentity = isIdentityCalibration(sensorCal)

  function setChannel(key: keyof SensorCalibration, field: keyof ChannelCalibration, value: string) {
    const n = Number(value)
    if (!Number.isFinite(n)) return
    // Guardrails: gains far from unity or huge offsets are almost certainly typos,
    // and quietly applying them would corrupt every reading.
    const bounded = field === 'gain' ? Math.min(10, Math.max(0.01, n)) : Math.min(100, Math.max(-100, n))
    setCalDraft((d) => ({ ...d, [key]: { ...d[key], [field]: bounded } }))
  }

  return (
    <div className="space-y-6">
      {/* ------------------------- Device / data source ------------------------- */}
      <Card>
        <CardHeader
          title="Device connection & data source"
          icon={<Cable aria-hidden />}
          subtitle="Connect the ESP32 over Web Serial. Until a validated device stream exists, the dashboard runs on labelled demo data."
          actions={<Badge tone={connection === 'connected' ? 'teal' : 'amber'}>{connection === 'connected' ? 'Hardware source' : 'Demo source'}</Badge>}
        />
        <CardBody className="space-y-4">
          {!serialSupported && (
            <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3.5 py-2.5 text-xs leading-relaxed text-amber-400">
              This browser does not expose Web Serial. Use desktop Chrome, Edge, or Opera to connect hardware.
            </p>
          )}
          {connection === 'error' && connectionError && (
            <p className="rounded-lg border border-critical-500/30 bg-critical-500/10 px-3.5 py-2.5 text-xs leading-relaxed text-critical-400">
              {connectionError}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex overflow-hidden rounded-lg border border-plum-500/70" role="tablist" aria-label="Transport type">
              {([
                ['web-serial', 'Web Serial (USB)', !serialSupported],
                ['websocket', 'WebSocket bridge', false],
              ] as const).map(([kind, label, unsupported]) => (
                <button
                  key={kind}
                  type="button"
                  role="tab"
                  aria-selected={transportKind === kind}
                  disabled={connection === 'connected' || connection === 'connecting' || unsupported}
                  title={unsupported ? 'Not available in this browser' : undefined}
                  onClick={() => setTransportKind(kind)}
                  className={cn(
                    'px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40',
                    transportKind === kind
                      ? 'bg-copper-500/15 text-copper-400'
                      : 'bg-plum-800/60 text-lavender hover:bg-plum-700/60 hover:text-ivory',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-lavender/60">
              {transportKind === 'web-serial'
                ? 'Direct USB connection — desktop Chrome, Edge, or Opera.'
                : 'Same JSON-line protocol via a ws:// bridge process.'}
            </p>
          </div>

          {transportKind === 'websocket' && (
            <label className="block max-w-md">
              <span className="label-caps mb-1.5 block">Bridge URL</span>
              <input
                type="text"
                value={websocketUrl}
                onChange={(e) => setWebsocketUrl(e.target.value)}
                disabled={connection === 'connected' || connection === 'connecting'}
                placeholder="ws://localhost:8765"
                className="w-full rounded-lg border border-plum-500/70 bg-plum-800/80 px-3 py-2 font-mono text-sm text-ivory"
              />
              <span className="mt-1 block text-[11px] text-lavender/60">
                The bridge relays the ESP32's JSON-line protocol over WebSocket.
              </span>
            </label>
          )}

          <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2.5 text-sm">
            <dt className="text-lavender/70">Transport</dt>
            <dd className="text-ivory">{transportName ?? 'None connected'}</dd>
            <dt className="text-lavender/70">Baud / format</dt>
            <dd className="text-ivory">115200 baud · one JSON object per line</dd>
            <dt className="text-lavender/70">Rejected payloads</dt>
            <dd className="numeric text-ivory">{invalidCount}</dd>
          </dl>

          <div className="flex flex-wrap gap-2">
            {connection === 'connected' ? (
              <Button variant="danger" onClick={() => void disconnectSerial()}>Disconnect device</Button>
            ) : (
              <Button
                variant="teal"
                onClick={() => void connectDevice()}
                disabled={transportKind === 'web-serial' ? !serialSupported : false}
              >
                Connect device…
              </Button>
            )}
          </div>

          <div>
            <p className="label-caps mb-2">Documented payload (structure example — values are illustrative)</p>
            <CodeBlock code={EXAMPLE_PAYLOAD} />
          </div>

          <p className="flex items-start gap-2 rounded-lg border border-plum-500/50 bg-plum-800/50 px-3.5 py-3 text-xs leading-relaxed text-lavender/85">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sea-400" aria-hidden />
            Secrets and API keys never live in this frontend. The connection layer is read-only: no website button
            can actuate a physical load — that requires separately validated firmware, protocol, and electrical
            protection.
          </p>
        </CardBody>
      </Card>

      {/* ---------------------------- Calibration ---------------------------- */}
      <Card>
        <CardHeader
          title="Calibration"
          icon={<Ruler aria-hidden />}
          subtitle="Gain / offset corrections applied to incoming hardware readings — derived against a trusted reference instrument"
          actions={
            <Badge tone={calIdentity ? 'neutral' : 'copper'}>
              {calIdentity ? 'No corrections' : 'Active'}
            </Badge>
          }
        />
        <CardBody className="space-y-4">
          <p className="text-xs leading-relaxed text-lavender/80">
            Enter the gain (<span className="font-mono">corrected = gain × raw + offset</span>) you derived by
            comparing this device's readings against a calibrated reference meter at one or more known points.
            Corrections apply <strong className="text-ivory">only to live hardware readings</strong> — demo data and
            imported records are never adjusted. Validation runs on the raw payload first, so calibration cannot
            make nonsense values pass.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead>
                <tr className="border-b border-plum-600/60 text-[11px] uppercase tracking-wider text-lavender/60">
                  <th className="px-3 py-2 font-semibold">Channel</th>
                  <th className="px-3 py-2 font-semibold">Gain</th>
                  <th className="px-3 py-2 font-semibold">Offset</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-plum-600/40">
                {(
                  [
                    ['voltage_v', 'Voltage (V)'],
                    ['current_a', 'Current (A)'],
                    ['temperature_c', 'Temperature (°C)'],
                  ] as const
                ).map(([key, label]) => (
                  <tr key={key}>
                    <td className="px-3 py-2 font-medium text-ivory">{label}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.001"
                        value={calDraft[key].gain}
                        onChange={(e) => setChannel(key, 'gain', e.target.value)}
                        aria-label={`${label} gain`}
                        className="numeric w-28 rounded-lg border border-plum-500/70 bg-plum-800/80 px-2.5 py-1.5 text-sm text-ivory"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.001"
                        value={calDraft[key].offset}
                        onChange={(e) => setChannel(key, 'offset', e.target.value)}
                        aria-label={`${label} offset`}
                        className="numeric w-28 rounded-lg border border-plum-500/70 bg-plum-800/80 px-2.5 py-1.5 text-sm text-ivory"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="teal"
              disabled={!calDirty}
              onClick={() => {
                setSensorCal(calDraft)
                pushEvent(
                  isIdentityCalibration(calDraft) ? 'info' : 'warn',
                  isIdentityCalibration(calDraft)
                    ? 'Sensor calibration cleared.'
                    : `Sensor calibration saved: ${describeCalibration(calDraft)}.`,
                )
              }}
            >
              {calDirty ? 'Save calibration' : 'Saved'}
            </Button>
            <Button
              variant="ghost"
              disabled={!calDirty}
              onClick={() => setCalDraft(sensorCal)}
            >
              Revert
            </Button>
            <Button
              variant="secondary"
              disabled={calIdentity}
              onClick={() => {
                setCalDraft(IDENTITY_CALIBRATION)
                resetSensorCal()
                pushEvent('info', 'Sensor calibration reset to identity (1.0 / 0.0).')
              }}
            >
              Reset to identity
            </Button>
          </div>

          <p className="flex items-start gap-2 rounded-lg border border-plum-500/50 bg-plum-800/50 px-3.5 py-3 text-xs leading-relaxed text-lavender/85">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sea-400" aria-hidden />
            Calibration corrects instrument bias — it does not validate the sensing chain. Until divider ratios,
            shunt values, and gain stages are verified against a traceable reference, reports built on calibrated
            readings remain engineering measurements, not certified values.
          </p>
        </CardBody>
      </Card>

      {/* ------------------------------ Motion ------------------------------ */}
      <Card>
        <CardHeader title="Motion & animation" icon={<Eye aria-hidden />} subtitle="Reduced-motion preference is respected throughout the interface and 3D scenes" />
        <CardBody className="grid gap-3 sm:grid-cols-3">
          {MOTION_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setMotionOverride(o.id)}
              aria-pressed={motionOverride === o.id}
              className={cn(
                'rounded-lg border px-4 py-3 text-left transition-colors',
                motionOverride === o.id
                  ? 'border-copper-500/70 bg-copper-500/10'
                  : 'border-plum-500/60 bg-plum-800/50 hover:border-plum-400/70',
              )}
            >
              <p className={cn('text-sm font-semibold', motionOverride === o.id ? 'text-copper-400' : 'text-ivory')}>
                {o.label}
              </p>
              <p className="mt-1 text-[11px] leading-snug text-lavender/70">{o.note}</p>
            </button>
          ))}
        </CardBody>
      </Card>

      {/* ------------------------------ Storage ------------------------------ */}
      <Card>
        <CardHeader title="Local data & storage" icon={<Database aria-hidden />} subtitle="Demo history lives in this browser — it is not the device's MicroSD card" />
        <CardBody className="space-y-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2.5 text-sm">
            <dt className="text-lavender/70">Storage mode</dt>
            <dd className="text-ivory">
              {storageMode === 'local' ? 'Browser local storage (persistent)' : 'In-memory only (browser storage unavailable)'}
            </dd>
            <dt className="text-lavender/70">Records stored</dt>
            <dd className="numeric text-ivory">{records.length}</dd>
            <dt className="text-lavender/70">Approx. size</dt>
            <dd className="numeric text-ivory">
              {storageMode === 'local' ? fmtBytes(storageBytes(window.localStorage, 'punarva.history.v1')) : '—'}
            </dd>
          </dl>
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" onClick={() => setConfirmClear(true)} disabled={records.length === 0}>
              <Trash2 className="h-4 w-4" aria-hidden /> Clear test history
            </Button>
          </div>
          <p className="text-xs leading-relaxed text-lavender/70">
            MicroSD records appear in this dashboard only after an explicit import (Test History → Import CSV).
            Nothing is transferred automatically.
          </p>
        </CardBody>
      </Card>

      {/* --------------------------- Browser support --------------------------- */}
      <Card>
        <CardHeader title="Browser support" icon={<Monitor aria-hidden />} subtitle="Detected capabilities in this browser" />
        <CardBody className="grid gap-3 sm:grid-cols-3">
          {(
            [
              ['Web Serial (device link)', support.webSerial, 'Chrome / Edge / Opera on desktop'],
              ['WebGL (3D scenes)', support.webGL, 'Conceptual fallback shown otherwise'],
              ['Local storage (history)', support.localStorage, 'In-memory fallback otherwise'],
            ] as const
          ).map(([label, ok, note]) => (
            <div key={label} className={cn('rounded-lg border px-4 py-3', ok ? 'border-sea-400/40 bg-sea-400/8' : 'border-plum-500/60 bg-plum-800/50')}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ivory">{label}</p>
                <Badge tone={ok ? 'teal' : 'neutral'}>{ok ? 'Available' : 'Unavailable'}</Badge>
              </div>
              <p className="mt-1 flex items-start gap-1.5 text-[11px] leading-snug text-lavender/70">
                <HardDrive className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                {note}
              </p>
            </div>
          ))}
        </CardBody>
      </Card>

      <Modal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear all test history?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmClear(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                clearAll()
                setConfirmClear(false)
                pushEvent('warn', 'All test history was cleared from Settings.')
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden /> Clear everything
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-lavender">
          This permanently removes all {records.length} record{records.length === 1 ? '' : 's'} from this browser.
        </p>
      </Modal>
    </div>
  )
}
