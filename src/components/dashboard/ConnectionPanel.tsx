import { Link } from 'react-router-dom'
import { Cable, CircleSlash, PlugZap, Settings2, Unplug } from 'lucide-react'
import { useDeviceStore } from '@/state/deviceStore'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusDot, type DotTone } from '@/components/ui/StatusDot'
import { EXAMPLE_PAYLOAD } from '@/services/validation'

const META: Record<string, { tone: DotTone; label: string }> = {
  disconnected: { tone: 'grey', label: 'Disconnected' },
  connecting: { tone: 'amber', label: 'Connecting…' },
  connected: { tone: 'teal', label: 'Connected' },
  error: { tone: 'red', label: 'Error' },
}

/**
 * Device connection panel. Handles: unsupported browser, permission/port
 * selection failure, no matching firmware stream, and clean disconnect —
 * each state is reported honestly instead of pretending to receive data.
 */
export function ConnectionPanel({ compact = false }: { compact?: boolean }) {
  const connection = useDeviceStore((s) => s.connection)
  const connectionError = useDeviceStore((s) => s.connectionError)
  const serialSupported = useDeviceStore((s) => s.serialSupported)
  const transportName = useDeviceStore((s) => s.transportName)
  const invalidCount = useDeviceStore((s) => s.invalidCount)
  const connectDevice = useDeviceStore((s) => s.connectDevice)
  const disconnectSerial = useDeviceStore((s) => s.disconnectSerial)
  const transportKind = useDeviceStore((s) => s.transportKind)
  const pushEvent = useDeviceStore((s) => s.pushEvent)

  const meta = META[connection]
  const busy = connection === 'connecting'
  const canConnect = transportKind === 'websocket' ? true : serialSupported

  function onConnect() {
    if (!canConnect) {
      pushEvent('warn', 'Web Serial is not supported in this browser — hardware connection unavailable.')
      return
    }
    void connectDevice()
  }

  return (
    <Card>
      <CardHeader
        title="Device connection"
        icon={<Cable aria-hidden />}
        actions={
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-lavender">
            <StatusDot tone={meta.tone} pulse={connection === 'connecting'} />
            {meta.label}
          </span>
        }
      />
      <CardBody className="space-y-4">
        {!canConnect && (
          <p className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2.5 text-xs leading-relaxed text-amber-400">
            <CircleSlash className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            Web Serial is unavailable in this browser. Use desktop Chrome, Edge, or Opera to connect the ESP32, or set up
            a WebSocket bridge in Settings.
          </p>
        )}

        {connection === 'error' && connectionError && (
          <p className="rounded-lg border border-critical-500/30 bg-critical-500/10 px-3 py-2.5 text-xs leading-relaxed text-critical-400">
            {connectionError}
          </p>
        )}

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs">
          <dt className="text-lavender/70">Transport</dt>
          <dd className="text-ivory">{transportName ?? 'None'}</dd>
          <dt className="text-lavender/70">Protocol</dt>
          <dd className="text-ivory">JSON lines @ 115200 baud (documented payload)</dd>
          <dt className="text-lavender/70">Rejected payloads</dt>
          <dd className="numeric text-ivory">{invalidCount}</dd>
        </dl>

        {compact && (
          <pre className="overflow-x-auto rounded-lg bg-plum-950/70 p-3 font-mono text-[10px] leading-relaxed text-sea-300/90">
{EXAMPLE_PAYLOAD}
          </pre>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {connection === 'connected' ? (
            <Button variant="danger" size="sm" onClick={() => void disconnectSerial()} loading={false}>
              <Unplug className="h-4 w-4" aria-hidden /> Disconnect
            </Button>
          ) : (
            <Button variant="teal" size="sm" onClick={onConnect} loading={busy} disabled={!canConnect}>
              <PlugZap className="h-4 w-4" aria-hidden />
              {busy ? 'Connecting…' : 'Connect device'}
            </Button>
          )}
          <Link
            to="/settings"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-lavender hover:bg-plum-700/60 hover:text-ivory"
          >
            <Settings2 className="h-3.5 w-3.5" aria-hidden /> Data source settings
          </Link>
        </div>

        <p className="text-[11px] leading-relaxed text-lavender/60">
          The website never activates physical hardware. Load control requires validated firmware, a safe hardware
          protocol, and electrical protection — none of which are implemented yet.
        </p>
      </CardBody>
    </Card>
  )
}
