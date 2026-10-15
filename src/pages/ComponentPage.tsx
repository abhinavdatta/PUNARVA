import { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Activity, Settings, ShieldCheck, Zap, Circle, CheckCircle, Clock, Plug, Signal } from 'lucide-react'
import { useDeviceStore } from '@/state/deviceStore'
import { browserSupportSummary } from '@/services/device/transports'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import type { TechComponent } from '@/data/components'
import { TECH_COMPONENTS, STATUS_LABEL } from '@/data/components'
import { cn } from '@/lib/utils'
import { fmtTime } from '@/lib/format'

export function ComponentPage() {
  const location = useLocation()
  const device = useDeviceStore()

  const support = browserSupportSummary()
  const devices = device.devices

  const componentStatuses = useMemo(() => {
    const isHardware = device.connection === 'connected'
    const hasRecentReading = device.lastValidAt !== null

    return TECH_COMPONENTS.map((comp) => {
      let status: TechComponent['status'] = comp.status
      let note = comp.statusNote
      let detected = false

      if (isHardware && hasRecentReading) {
        if (comp.id === 'ads1115') {
          detected = true
          if (status === 'in-development') {
            status = 'implemented'
            note = 'I2C ADC detected — ADS1115 responding at 0x48, providing valid readings.'
          }
        }
        if (comp.id === 'oled') {
          if (status === 'planned') {
            note = 'OLED auto-detection happens in firmware at boot. Check serial monitor for "[punarva] OLED: ok/not found".'
          }
        }
        if (comp.id === 'esp32') {
          detected = true
          if (status === 'in-development') {
            status = 'connected'
            note = 'ESP32 connected and streaming valid measurements.'
          }
        }
        if (comp.id === 'voltage-sensing') {
          if (device.lastReading && device.lastReading.voltage_v !== null) {
            detected = true
            if (status === 'in-development') {
              status = 'implemented'
              note = 'Voltage sensing active — battery voltage readings valid.'
            }
          }
        }
        if (comp.id === 'current-sensor') {
          if (device.lastReading && device.lastReading.current_a !== null) {
            detected = true
            if (status === 'planned') {
              status = 'in-development'
              note = 'Current sensing active — shunt/amp readings valid.'
            }
          }
        }
        if (comp.id === 'temp-sensor') {
          if (device.lastReading && device.lastReading.temperature_c !== null) {
            detected = true
            if (status === 'planned') {
              status = 'in-development'
              note = 'Temperature sensor active — thermal readings valid.'
            }
          }
        }
        if (comp.id === 'microsd') {
          note = 'MicroSD status visible in firmware serial log at boot.'
        }
        if (comp.id === 'load-stage') {
          note = 'Load actuation disabled for safety — requires validated firmware, protocol, and electrical protection.'
        }
      }

      if (!isHardware && comp.id === 'esp32') {
        note = 'No ESP32 connected — device not detected via Web Serial or WebSocket bridge.'
      }
      if (!isHardware && (comp.id === 'ads1115' || comp.id === 'voltage-sensing' || comp.id === 'current-sensor' || comp.id === 'temp-sensor')) {
        if (status === 'in-development' || status === 'planned') {
          note = 'Hardware not connected — cannot verify component presence.'
        }
      }

      return { ...comp, status, note, detected }
    })
  }, [device.connection, device.lastReading, device.lastValidAt])

  const byStatus = useMemo(() => {
    const groups: Record<string, (typeof componentStatuses)> = {
      connected: [],
      implemented: [],
      'in-development': [],
      planned: [],
    }
    for (const comp of componentStatuses) {
      groups[comp.status]?.push(comp)
    }
    return groups
  }, [componentStatuses])

  const total = TECH_COMPONENTS.length
  const connectedCount = byStatus.connected.length
  const implementedCount = byStatus.implemented.length
  const inDevCount = byStatus['in-development'].length
  const plannedCount = byStatus.planned.length

  const overallStatus =
    connectedCount === total
      ? 'all-connected'
      : implementedCount + connectedCount === total
      ? 'all-implemented'
      : 'partial'

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
        <CardHeader title="Component Status" icon={<Activity className="mr-2 h-4 w-4" />} />
        <CardBody className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'flex h-3 w-3 rounded-full',
                  overallStatus === 'all-connected' ? 'bg-sea-400' :
                  overallStatus === 'all-implemented' ? 'bg-amber-400' :
                  'bg-plum-500'
                )}
              />
              <span className="text-sm font-medium text-ivory">
                {overallStatus === 'all-connected' ? 'All components connected' :
                  overallStatus === 'all-implemented' ? 'All components implemented' :
                  'Partial — some components not yet verified'}
              </span>
            </div>
            <Badge
              tone={overallStatus === 'all-connected' ? 'teal' : overallStatus === 'all-implemented' ? 'amber' : 'neutral'}
            >
              {connectedCount}/{total} connected
            </Badge>
          </div>

          <div className="grid grid-cols-4 gap-3 text-center">
            <div className="rounded-lg border border-sea-400/40 bg-sea-400/8 px-3 py-2">
              <p className="text-lg font-bold text-sea-300">{connectedCount}</p>
              <p className="text-[10px] uppercase tracking-wider text-lavender/60">Connected</p>
            </div>
            <div className="rounded-lg border border-amber-400/40 bg-amber-400/8 px-3 py-2">
              <p className="text-lg font-bold text-amber-300">{implementedCount}</p>
              <p className="text-[10px] uppercase tracking-wider text-lavender/60">Implemented</p>
            </div>
            <div className="rounded-lg border border-plum-500/60 bg-plum-800/40 px-3 py-2">
              <p className="text-lg font-bold text-lavender">{inDevCount}</p>
              <p className="text-[10px] uppercase tracking-wider text-lavender/60">In Dev</p>
            </div>
            <div className="rounded-lg border border-plum-500/40 bg-plum-800/20 px-3 py-2">
              <p className="text-lg font-bold text-lavender/60">{plannedCount}</p>
              <p className="text-[10px] uppercase tracking-wider text-lavender/60">Planned</p>
            </div>
          </div>          </CardBody>
      </Card>

      {/* Connected devices */}
      {devices.length === 0 ? (
        <Card className="mt-4 border-plum-500/60 bg-plum-800/40">
          <CardHeader title="Connected devices" icon={<Plug className="mr-2 h-4 w-4" />} />
          <CardBody>
            <p className="text-sm text-lavender/80">No devices currently connected.</p>
            <p className="mt-1 text-xs text-lavender/60">
              Connect an ESP32 via Web Serial (Chrome/Edge/Opera on desktop) or a WebSocket bridge to see device details here.
            </p>
          </CardBody>
        </Card>
      ) : (
        <Card className="mt-4">
          <CardHeader title="Connected devices" icon={<Plug className="mr-2 h-4 w-4" />} actions={<Badge>{devices.length}</Badge>} />
          <CardBody className="space-y-3">
            {devices.map((dev) => (
              <div
                key={dev.id}
                className="rounded-lg border border-sea-400/40 bg-sea-400/8 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Signal className="h-4 w-4 text-sea-400" aria-hidden />
                      <span className="text-sm font-semibold text-ivory">{dev.transportName}</span>
                    </div>
                    <p className="mt-1 text-xs text-lavender/60">
                      Kind: {dev.kind === 'web-serial' ? 'Web Serial (USB)' : 'WebSocket bridge'} · ID: {dev.id}
                    </p>
                  </div>
                  <Badge tone={dev.connectedAt ? 'teal' : 'neutral'}>
                    {dev.connectedAt ? 'Connected' : 'Waiting'}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <p className="text-lavender/60">Connected at</p>
                    <p className="text-ivory">{dev.connectedAt ? fmtTime(dev.connectedAt) : '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-lavender/60">Last reading</p>
                    <p className="text-ivory">{dev.lastValidAt ? fmtTime(dev.lastValidAt) : 'none yet'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-lavender/60">Invalid payloads</p>
                    <p className="text-ivory">{dev.invalidCount}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-lavender/60">Device info</p>
                    <p className="text-ivory font-mono">{dev.info ?? 'none reported'}</p>
                  </div>
                </div>
                {dev.lastReading && (
                  <div className="mt-3 flex items-center gap-4 text-xs">
                    <span className="text-lavender/60">Last sample:</span>
                    <span className="font-mono text-sea-300">{dev.lastReading.voltage_v.toFixed(2)} V</span>
                    <span className="font-mono text-copper-400">{dev.lastReading.current_a.toFixed(2)} A</span>
                    <span className="font-mono text-amber-400">{dev.lastReading.temperature_c.toFixed(1)} °C</span>
                  </div>
                )}
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {(['connected', 'implemented', 'in-development', 'planned'] as const).map((status) => {
        const items = byStatus[status]
        if (items.length === 0) return null
        return (
          <Card key={status} className="mt-4">
            <CardHeader title={STATUS_LABEL[status]} actions={<Badge tone={status === 'connected' ? 'teal' : status === 'implemented' ? 'amber' : status === 'in-development' ? 'plum' : 'neutral'}>{items.length}</Badge>} />
            <CardBody className="space-y-3">
              {items.map((comp) => (
                <div
                  key={comp.id}
                  className={cn(
                    'rounded-lg border px-4 py-3',
                    comp.status === 'connected' ? 'border-sea-400/40 bg-sea-400/8' :
                    comp.status === 'implemented' ? 'border-amber-400/40 bg-amber-400/8' :
                    'border-plum-500/60 bg-plum-800/40'
                  )}
                >
                  <div className="flex items-start gap-3">
                    {comp.status === 'connected' ? (
                      <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-sea-400" aria-label="Connected" />
                    ) : comp.status === 'implemented' ? (
                      <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-label="Implemented" />
                    ) : comp.status === 'in-development' ? (
                      <Clock className="mt-0.5 h-5 w-5 shrink-0 text-plum-400" aria-label="In development" />
                    ) : (
                      <Circle className="mt-0.5 h-5 w-5 shrink-0 text-lavender/40" aria-label="Planned" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-ivory">{comp.name}</span>
                        <Badge
                          tone={comp.status === 'connected' ? 'teal' : comp.status === 'implemented' ? 'amber' : comp.status === 'in-development' ? 'neutral' : 'neutral'}
                        >
                          {STATUS_LABEL[comp.status]}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-lavender/80">{comp.purpose}</p>
                      <p className="mt-1 text-xs leading-relaxed text-lavender/60 font-mono">{comp.note}</p>
                    </div>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        )
      })}

      <Card className="mt-4 border-amber-400/40 bg-amber-400/8">
        <CardHeader title="How detection works" icon={<Settings className="mr-2 h-4 w-4" />} />
        <CardBody>
          <div className="space-y-3 text-xs leading-relaxed text-lavender/80">
            <p>Component status is derived from the live device connection and measurement stream:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>ESP32 controller</strong> — detected when Web Serial or WebSocket bridge is connected and streaming valid measurements.</li>
              <li><strong>ADS1115 ADC</strong> — inferred when voltage/current readings are present in the live stream (I2C ADC responding at 0x48).</li>
              <li><strong>Voltage/current/temp sensors</strong> — detected when their respective channel values are non-null in recent readings.</li>
              <li><strong>OLED display</strong> — firmware auto-detects at boot (<code>oled.begin()</code>) and logs to serial; not directly observable from the JSON protocol.</li>
              <li><strong>MicroSD module</strong> — visible in firmware serial log during boot; not detectable from JSON payloads.</li>
              <li><strong>Load stage</strong> — intentionally disabled for safety; no website command can actuate physical hardware.</li>
            </ul>
            <p>Some components (OLED, MicroSD) require checking the ESP32 serial monitor at boot to confirm presence. Connect the device via Web Serial (Chrome/Edge/Opera on desktop) and look for the firmware's <code>[punarva]</code> diagnostic lines.</p>
            <div className="flex items-start gap-2 rounded-lg border border-plum-500/50 bg-plum-800/50 px-3 py-2.5 text-xs leading-relaxed text-lavender/85">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sea-400" aria-hidden />
              This dashboard <strong>never activates physical hardware</strong>. Load control requires validated firmware, a safe hardware protocol, and electrical protection — none of which are implemented yet. The website is read-only by design.
            </div>
          </div>
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader title="Browser capabilities" icon={<Zap className="mr-2 h-4 w-4" />} />
        <CardBody>
          <div className="grid grid-cols-3 gap-3">
            {([
              ['Web Serial', support.webSerial, 'Desktop Chrome/Edge/Opera'],
              ['WebGL', support.webGL, '3D scenes'],
              ['localStorage', support.localStorage, 'History persistence'],
            ] as const).map(([label, ok, note]) => (
              <div
                key={label}
                className={cn(
                  'rounded-lg border px-3 py-2 text-sm',
                  ok ? 'border-sea-400/40 bg-sea-400/8' : 'border-plum-500/60 bg-plum-800/40'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-ivory">{label}</span>
                  <Badge tone={ok ? 'teal' : 'neutral'}>
                    {ok ? 'OK' : 'Missing'}
                  </Badge>
                </div>
                <p className="mt-0.5 text-[11px] text-lavender/60">{note}</p>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <footer className="mt-8 text-xs text-lavender/60">
        {location.pathname} · PUNARVA v{"0.1.0"} • <Link to="/" className="hover:text-sea-300">dashboard</Link>
      </footer>
    </div>
  )
}