import { create } from 'zustand'
import type { ConnectionStatus, DataSource, Reading, SystemEvent } from '@/types'
import { isStaleReading, validateReading } from '@/services/validation'
import { WebSerialTransport, isWebSerialSupported, type DeviceTransport } from '@/services/device/transports'
import { WebSocketTransport, isWebSocketSupported } from '@/services/device/webSocketTransport'
import { uid } from '@/lib/uid'

const MAX_EVENTS = 60

export type DeviceTransportKind = 'web-serial' | 'websocket'

interface DeviceState {
  connection: ConnectionStatus
  connectionError: string | null
  transportName: string | null
  serialSupported: boolean
  websocketSupported: boolean
  transportKind: DeviceTransportKind
  websocketUrl: string
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
          set({ connection: 'disconnected', transportName: null })
          get().pushEvent('warn', `Device disconnected${reason ? ` — ${reason}` : ''}.`)
        },
      })
      set({ connection: 'connected', transportName: transport.name })
      get().pushEvent('info', `Connected via ${transport.name}. Waiting for valid measurement lines…`)
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
    set({
      lastReading: result.value,
      lastReadingSource: 'HARDWARE',
      lastValidAt: result.value.timestamp,
    })
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
