/**
 * WebSocket transport — network bridge alternative to Web Serial.
 *
 * Implements the same `DeviceTransport` interface the hardware docs describe,
 * so a proxy/bridge process (e.g. a small Python/Node bridge that talks to the
 * ESP32's serial port or receives its UDP packets) can feed the SAME validated
 * JSON-line protocol over ws://… — measurements flow through the exact same
 * ingest validation path.
 *
 * Framing: one JSON object per WebSocket text message. The bridge may also
 * send newline-separated batches in a single message; those are split too.
 *
 * NOTE (project honesty rule): this transport is READ-ONLY. It never sends
 * anything to the device; actuation has no path anywhere in the software.
 */

import type { DeviceTransport, TransportCallbacks } from './transports'

export function isWebSocketSupported(): boolean {
  return typeof WebSocket !== 'undefined'
}

export class WebSocketTransport implements DeviceTransport {
  readonly name: string
  private socket: WebSocket | null = null
  private running = false
  private cb: TransportCallbacks | null = null
  private readonly url: string

  constructor(url: string) {
    this.url = url
    let label: string
    try {
      const parsed = new URL(url)
      label = `WebSocket (${parsed.host})`
    } catch {
      label = 'WebSocket'
    }
    this.name = label
  }

  connect(callbacks: TransportCallbacks): Promise<void> {
    if (!isWebSocketSupported()) {
      return Promise.reject(new Error('WebSocket is not available in this environment.'))
    }
    this.cb = callbacks
    let socket: WebSocket
    try {
      socket = new WebSocket(this.url)
    } catch (err) {
      return Promise.reject(new Error(`Invalid WebSocket URL: ${err instanceof Error ? err.message : String(err)}`))
    }
    this.socket = socket
    this.running = true

    return new Promise<void>((resolve, reject) => {
      let settled = false
      const settleWindow = window.setTimeout(() => {
        if (socket.readyState !== WebSocket.OPEN) {
          socket.close()
          if (!settled) {
            settled = true
            reject(new Error('Connection timed out — is the bridge process running at that URL?'))
          }
        }
      }, 8000)

      socket.addEventListener('open', () => {
        window.clearTimeout(settleWindow)
        if (!settled) {
          settled = true
          resolve()
        }
      })

      socket.addEventListener('message', (event) => {
        const data = typeof event.data === 'string' ? event.data : ''
        // One JSON object per message, OR newline-delimited batch.
        for (const lineRaw of data.split('\n')) {
          const line = lineRaw.trim()
          if (line === '') continue
          try {
            this.cb?.onRaw(JSON.parse(line))
          } catch {
            this.cb?.onError(`Malformed message (expected JSON line): "${line.slice(0, 80)}"`)
          }
        }
      })

      socket.addEventListener('close', (event) => {
        window.clearTimeout(settleWindow)
        this.socket = null
        if (this.running && settled) {
          this.cb?.onClose(event.reason || 'Connection closed')
        }
        if (!settled) {
          settled = true
          reject(new Error('Connection closed before it opened.'))
        }
      })

      socket.addEventListener('error', () => {
        window.clearTimeout(settleWindow)
        if (socket.readyState !== WebSocket.OPEN && !settled) {
          settled = true
          reject(new Error('WebSocket connection failed — check the URL and that the bridge is reachable.'))
        }
      })
    })
  }

  async disconnect(): Promise<void> {
    this.running = false
    const socket = this.socket
    this.socket = null
    this.cb = null
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      await new Promise<void>((resolve) => {
        socket.addEventListener('close', () => resolve(), { once: true })
        try {
          socket.close()
        } catch {
          resolve()
        }
        window.setTimeout(resolve, 1500)
      })
    }
  }
}
