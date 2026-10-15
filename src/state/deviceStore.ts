import { create } from 'zustand'
import type { ConnectionStatus, DataSource, Reading, SystemEvent } from '@/types'
import { isStaleReading, validateReading } from '@/services/validation'
import { WebSerialTransport, isWebSerialSupported, type DeviceTransport } from '@/services/device/transports'
import { WebSocketTransport, isWebSocketSupported } from '@/services/device/webSocketTransport'
import { useCalibrationStore, isIdentityCalibration, describeCalibration } from '@/state/calibrationStore'
import { uid } from '@/lib/uid'

const MAX_EVENTS = 60

export type DeviceTransportKind = 'web-serial' | 'websocket'

export interface ConnectedDevice {
  /** Unique-ish id for this connection session (port/socket identity). */
  id: string
  /** Transport-layer name, e.g. "Web Serial (USB)" or "WebSocket (localhost:8765)". */
  transportName: string
  /** Kind: web-serial or websocket. */
  kind: DeviceTransportKind
  /** When this device's stream was first detected as live. */
  connectedAt: string | null
  /** Last validated reading timestamp from this device, if any. */
  lastValidAt: string | null
  /** Most recent validated reading, if any. */
  lastReading: import('@/types').Reading | null
  /** Rejected payloads seen on this connection. */
  invalidCount: number
  /** Implementation-defined info reported by the device/firmware (serial, firmware id, etc.). */
  info: string | null
}

interface DeviceState {
  connection: ConnectionStatus
  connectionError: string | null
  transportName: string | null
  serialSupported: boolean
  websocketSupported: boolean
  transportKind: DeviceTransportKind
  websocketUrl: string
  devices: ConnectedDevice[]
  lastReading: Reading | null
  lastReadingSource: Extract<DataSource, 'DEMO' | 'HARDWARE'> | null
  lastValidAt: string | null
  invalidCount: number
  events: SystemEvent[]
  eventUnseen: number

  pushEvent: (level: SystemEvent['level'], message: string) => void
  markEventsSeen: () => void
  setTransportKind: (kind: DeviceTransportKind) => void
  setWebsocketUrl: (url: string) => void
  registerDevice: (device: ConnectedDevice) => void
  updateDeviceReading: (deviceId: string, reading: import('@/types').Reading, timestamp: string) => void
  updateDeviceInfo: (deviceId: string, info: string | null) => void
  removeDevice: (deviceId: string) => void
  connectDevice: () => Promise<void>
  disconnectSerial: () => Promise<void>
  /** Record a validated demo reading (demo test live values). Always labelled DEMO. */
  noteDemoReading: (values: { voltage_v: number; current_a: number; temperature_c: number }) => void
  /** Ingest a raw payload from the transport. Invalid data is rejected loudly. */
  ingestRaw: (raw: unknown) => void
}

let transport: DeviceTransport | null = null

/** Basic sanity check for ws:// or wss:// URLs. */
function parseWebsocketUrl(url: string): string | null {
  const trimmed = url.trim()
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') return null
    if (parsed.host === '') return null
    return trimmed
  } catch {
    return null
  }
}

export const useDeviceStore = create<DeviceState>()((set, get) => ({
  connection: 'disconnected',
  connectionError: null,
  transportName: null,
  serialSupported: isWebSerialSupported(),
  websocketSupported: isWebSocketSupported(),
  transportKind: 'web-serial',
  websocketUrl: 'ws://localhost:8765',
  lastReading: null,
  lastReadingSource: null,
  lastValidAt: null,
  invalidCount: 0,
  events: [],
  eventUnseen: 0,
  devices: [],

  pushEvent: (level, message) =>
    set((s) => ({
      events: [...s.events, { id: uid(), at: new Date().toISOString(), level, message }].slice(-MAX_EVENTS),
      eventUnseen: s.eventUnseen + 1,
    })),

  markEventsSeen: () => set({ eventUnseen: 0 }),

  setTransportKind: (transportKind) => {
    if (get().connection === 'connected' || get().connection === 'connecting') return
    set({ transportKind })
  },

  setWebsocketUrl: (url) => set({ websocketUrl: url }),

  registerDevice: (device: ConnectedDevice) =>
    set((s) => ({
      devices: s.devices.some((d) => d.id === device.id)
        ? s.devices.map((d) => (d.id === device.id ? device : d))
        : [...s.devices, device],
    })),

  updateDeviceReading: (deviceId, reading, timestamp) =>
    set((s) => ({
      devices: s.devices.map((d) =>
        d.id === deviceId ? { ...d, lastReading: reading, lastValidAt: timestamp, connectedAt: d.connectedAt ?? timestamp } : d
      ),
      lastReading: reading,
      lastReadingSource: 'HARDWARE',
      lastValidAt: timestamp,
    })),

  updateDeviceInfo: (deviceId, info) =>
    set((s) => ({
      devices: s.devices.map((d) => (d.id === deviceId ? { ...d, info } : d)),
    })),

  removeDevice: (deviceId) =>
    set((s) => {
      const remaining = s.devices.filter((d) => d.id !== deviceId)
      const next = remaining[0]
      return {
        devices: remaining,
        connection: next ? (s.connection === 'connected' ? 'connected' : s.connection) : 'disconnected',
        transportName: next?.transportName ?? null,
        lastReading: next?.lastReading ?? null,
        lastReadingSource: next ? (next.lastReading ? 'HARDWARE' : s.lastReadingSource) : null,
        lastValidAt: next?.lastValidAt ?? null,
        invalidCount: remaining.reduce((a, d) => a + d.invalidCount, 0),
      }
    }),

  connectDevice: async () => {
    if (get().connection === 'connecting' || get().connection === 'connected') return

    // Tear down any transport from a previous session kind.
    if (transport) {
      try {
        await transport.disconnect()
      } catch {
        /* ignore */
      }
      transport = null
    }

    const kind = get().transportKind
    try {
      if (kind === 'websocket') {
        const url = parseWebsocketUrl(get().websocketUrl)
        if (url === null) {
          throw new Error('Enter a valid ws:// or wss:// URL for the bridge.')
        }
        transport = new WebSocketTransport(url)
      } else {
        transport = new WebSerialTransport()
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      set({ connection: 'error', connectionError: message, transportName: null })
      get().pushEvent('error', `Connection failed — ${message}`)
      return
    }

    set({ connection: 'connecting', connectionError: null })
    get().pushEvent('info', kind === 'websocket' ? `Connecting to bridge ${get().websocketUrl}…` : 'Requesting serial port…')

    try {
      await transport.connect({
        onRaw: (raw) => get().ingestRaw(raw),
        onError: (message) => {
          set((s) => ({ invalidCount: s.invalidCount + 1 }))
          get().pushEvent('error', message)
        },
        onClose: (reason) => {
          const activeDevice = get().devices[0]
          if (activeDevice) get().removeDevice(activeDevice.id)
          set({ connection: 'disconnected', transportName: null })
          get().pushEvent('warn', `Device disconnected${reason ? ` — ${reason}` : ''}.`)
        },
      })
      const deviceId = transport instanceof WebSerialTransport
        ? `ws-serial-${uid()}`
        : `ws-${new URL(get().websocketUrl).hostname}`
      get().registerDevice({
        id: deviceId,
        transportName: transport.name,
        kind: kind,
        connectedAt: null,
        lastValidAt: null,
        lastReading: null,
        invalidCount: 0,
        info: null,
      })
      set({ connection: 'connected', transportName: transport.name })
      get().pushEvent('info', `Connected via ${transport.name}. Device registered: ${deviceId}`)
      const cal = useCalibrationStore.getState().sensor
      if (!isIdentityCalibration(cal)) {
        get().pushEvent('warn', `Sensor calibration ACTIVE for incoming hardware readings: ${describeCalibration(cal)} (see Settings → Calibration).`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      set({ connection: 'error', connectionError: message, transportName: null })
      get().pushEvent('error', `Connection failed — ${message}`)
    }
  },

  disconnectSerial: async () => {
    if (transport) await transport.disconnect()
    transport = null
    set({ connection: 'disconnected', transportName: null, connectionError: null })
    get().pushEvent('info', 'Device disconnected by user.')
  },

  ingestRaw: (raw) => {
    const result = validateReading(raw)
    if (!result.ok || !result.value) {
      set((s) => ({ invalidCount: s.invalidCount + 1 }))
      get().pushEvent('warn', `Rejected invalid payload: ${result.errors[0] ?? 'unknown validation error'}`)
      return
    }
    if (result.errors.length > 0) {
      get().pushEvent('warn', `Payload accepted with issues: ${result.errors[0]}`)
    }
    // Apply user-entered sensor calibration (gain * raw + offset). Validation
    // above runs on the RAW payload first, so nonsense is still rejected
    // before any calibration arithmetic can reshape it into plausibility.
    const cal = useCalibrationStore.getState().sensor
    const rawValue = result.value
    const calibrated: Reading = isIdentityCalibration(cal)
      ? rawValue
      : {
          voltage_v: rawValue.voltage_v * cal.voltage_v.gain + cal.voltage_v.offset,
          current_a: rawValue.current_a * cal.current_a.gain + cal.current_a.offset,
          temperature_c: rawValue.temperature_c * cal.temperature_c.gain + cal.temperature_c.offset,
          timestamp: rawValue.timestamp,
        }
    // Route to the active device if any; fall back to global state.
    const activeDevice = get().devices[0]
    if (activeDevice) {
      get().updateDeviceReading(activeDevice.id, calibrated, calibrated.timestamp)
    } else {
      set({
        lastReading: calibrated,
        lastReadingSource: 'HARDWARE',
        lastValidAt: calibrated.timestamp,
      })
    }
  },

  noteDemoReading: (values) => {
    const now = new Date().toISOString()
    set({ lastReading: { ...values, timestamp: now }, lastReadingSource: 'DEMO', lastValidAt: now })
  },
}))

/* ------------------------------- selectors ------------------------------- */

export function selectIsStale(state: DeviceState, maxAgeMs = 5000): boolean {
  if (state.lastValidAt === null) return true
  return isStaleReading(state.lastValidAt, maxAgeMs)
}

/** The data source label the top bar should display right now. */
export function selectCurrentSource(state: DeviceState): DataSource {
  return state.connection === 'connected' ? 'HARDWARE' : 'DEMO'
}
