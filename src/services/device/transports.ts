/**
 * Device communication layer — deliberately separate from all UI components.
 *
 * The dashboard consumes validated readings through this module. Today the
 * only transport is Web Serial (Chrome/Edge/Opera desktop). A future backend
 * WebSocket bridge can implement the same `DeviceTransport` interface without
 * touching the UI.
 *
 * Documented wire protocol (one JSON object per line, 115200 baud):
 *   {"voltage_v":3.72,"current_a":0.45,"temperature_c":28.3,"timestamp":"ISO-8601"}
 * Values above illustrate the STRUCTURE only — they are not real readings.
 *
 * NOTE: a website button must never be able to switch a physical load. This
 * layer is read-only by design; actuation requires separately validated
 * firmware, protocol, and electrical protection.
 */

export interface TransportCallbacks {
  onRaw: (raw: unknown) => void
  onError: (message: string) => void
  onClose: (reason?: string) => void
}

export interface DeviceTransport {
  readonly name: string
  connect(callbacks: TransportCallbacks): Promise<void>
  disconnect(): Promise<void>
}

/* ---- Minimal Web Serial typings (kept local: lib.dom may not ship them) ---- */

interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>
  close(): Promise<void>
  readable: ReadableStream<Uint8Array> | null
  forget?(): Promise<void>
}

interface SerialLike {
  requestPort(options?: { filters?: unknown[] }): Promise<SerialPortLike>
}

function getSerial(): SerialLike | null {
  if (typeof navigator === 'undefined') return null
  return (navigator as unknown as { serial?: SerialLike }).serial ?? null
}

export function isWebSerialSupported(): boolean {
  return getSerial() !== null
}

export function browserSupportSummary(): { webSerial: boolean; webGL: boolean; localStorage: boolean } {
  let webGL = false
  try {
    const canvas = document.createElement('canvas')
    webGL = !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    webGL = false
  }
  let localStorageOk = false
  try {
    window.localStorage.setItem('__probe__', '1')
    window.localStorage.removeItem('__probe__')
    localStorageOk = true
  } catch {
    localStorageOk = false
  }
  return { webSerial: isWebSerialSupported(), webGL, localStorage: localStorageOk }
}

/* ------------------------------- Web Serial ------------------------------- */

export class WebSerialTransport implements DeviceTransport {
  readonly name = 'Web Serial (USB)'
  private port: SerialPortLike | null = null
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  private running = false
  private cb: TransportCallbacks | null = null

  async connect(callbacks: TransportCallbacks): Promise<void> {
    const serial = getSerial()
    if (!serial) {
      throw new Error('Web Serial is not supported in this browser. Use Chrome, Edge, or Opera on desktop.')
    }
    this.cb = callbacks
    let port: SerialPortLike
    try {
      port = await serial.requestPort()
    } catch (err) {
      throw new Error(err instanceof DOMException && err.name === 'NotFoundError'
        ? 'No serial port was selected.'
        : `Could not open a serial port: ${err instanceof Error ? err.message : String(err)}`)
    }
    this.port = port
    try {
      await port.open({ baudRate: 115200 })
    } catch (err) {
      this.port = null
      throw new Error(`Port opened but could not be configured (is another program using it?): ${err instanceof Error ? err.message : String(err)}`)
    }
    this.running = true
    void this.readLoop()
  }

  private async readLoop(): Promise<void> {
    const { port, cb } = this
    if (!port?.readable || !cb) return
    const decoder = new TextDecoder()
    let buffer = ''
    try {
      this.reader = port.readable.getReader()
      while (this.running) {
        const { value, done } = await this.reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let nl: number
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl).trim()
          buffer = buffer.slice(nl + 1)
          if (line === '') continue
          try {
            cb.onRaw(JSON.parse(line))
          } catch {
            cb.onError(`Malformed message (expected JSON line): "${line.slice(0, 80)}"`)
          }
        }
      }
      cb.onClose('Serial stream ended')
    } catch (err) {
      if (this.running) {
        cb?.onError(`Serial read failed: ${err instanceof Error ? err.message : String(err)}`)
        cb?.onClose('Read error')
      }
    } finally {
      this.reader = null
    }
  }

  async disconnect(): Promise<void> {
    this.running = false
    try {
      await this.reader?.cancel()
    } catch {
      /* reader already closed */
    }
    try {
      await this.port?.close()
    } catch {
      /* port already closed */
    }
    this.port = null
    this.cb = null
  }
}
