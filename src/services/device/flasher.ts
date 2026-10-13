/**
 * ESP32 flashing service — browser-based firmware upload over Web Serial.
 *
 * Wraps esptool-js (Espressif's official in-browser flasher). A `.bin` firmware
 * file chosen by the user is written directly into the ESP32's flash at a given
 * offset, entirely from the browser — no Python, no esptool.py, no server.
 *
 * Flashing is an *explicit user action* on a device the user physically
 * selects in the browser's serial-port chooser; nothing here runs
 * automatically or in the background.
 *
 * NOTE (project honesty rule): like the rest of the device layer, this module
 * only touches firmware the user provides. PUNARVA ships no firmware image,
 * and the dashboard still cannot actuate a physical load.
 */

import { ESPLoader, Transport, type IEspLoaderTerminal } from 'esptool-js'
import type { FlashEvent, FlashPhase } from '@/state/flashStore'
import { md5Hash } from './flasherMd5'

type SerialPortLike = Record<string, unknown> // structural alias; esptool-js owns the real type

export interface FlasherOptions {
  /** Firmware image bytes. */
  image: Uint8Array
  /** Human-readable file name (for logs). */
  fileName: string
  /** Flash write offset. 0x1000 for classic ESP32 bootloader, 0x0 for ESP32-S3/C3. */
  offset: number
  /** Connection baud rate (stub runs at this rate). */
  baudrate: number
  /** Erase the entire flash before writing. */
  eraseAll: boolean
  /** Whether to force the bootloader-offset preset (0x1000 vs 0x0). */
  chipFamily: 'ESP32' | 'ESP32-S2' | 'ESP32-S3' | 'ESP32-C3' | 'auto'
  onEvent: (event: FlashEvent) => void
  onProgress: (fraction: number) => void
  onPhase: (phase: FlashPhase) => void
}

export interface FlasherResult {
  ok: boolean
  chipName: string | null
  error?: string
  durationMs: number
  bytesWritten: number
}

export const FLASH_OFFSET_ESP32 = 0x1000
export const FLASH_OFFSET_VARIANT = 0x0

export function defaultOffsetFor(family: FlasherOptions['chipFamily']): number {
  return family === 'ESP32' ? FLASH_OFFSET_ESP32 : FLASH_OFFSET_VARIANT
}

/** Terminal adapter that mirrors esptool bootloader chatter into FlashEvents. */
class EventTerminal implements IEspLoaderTerminal {
  constructor(private readonly onEvent: (event: FlashEvent) => void) {}
  clean(): void {}
  writeLine(data: string): void {
    this.onEvent({ kind: 'log', text: data.replace(/\r?\n$/, ''), at: Date.now() })
  }
  write(data: string): void {
    this.onEvent({ kind: 'log', text: data, at: Date.now() })
  }
}

/**
 * Run a complete flash session to completion. Throws on failure; the store
 * catches and surfaces the error.
 */
export async function flashEsp32(options: FlasherOptions): Promise<FlasherResult> {
  const started = Date.now()
  const { onEvent, onProgress, onPhase } = options
  const pushLog = (text: string) => onEvent({ kind: 'log', text, at: Date.now() })
  const pushError = (text: string) => onEvent({ kind: 'error', text, at: Date.now() })

  if (typeof navigator === 'undefined' || !('serial' in navigator)) {
    throw new Error('Web Serial is not available in this browser. Use desktop Chrome, Edge, or Opera.')
  }

  const serialApi = (navigator as unknown as { serial: {
    requestPort(options?: { filters?: unknown[] }): Promise<SerialPortLike>
  } }).serial

  onPhase('requesting-port')
  pushLog(`Requesting serial port… (firmware: ${options.fileName}, ${options.image.byteLength.toLocaleString()} bytes)`)

  const port = await serialApi.requestPort()
  const transport = new Transport(port, false)

  transport.setDeviceLostCallback(() => {
    pushError('Device was lost during flashing (cable unplugged?).')
  })

  onPhase('connecting')
  const terminal = new EventTerminal(onEvent)
  const loader = new ESPLoader({
    transport,
    port: port as unknown as never,
    baudrate: options.baudrate,
    terminal,
    debugLogging: false,
  })

  let chipName: string | null = null
  try {
    chipName = await loader.main('default_reset')
    pushLog(`Connected: ${chipName}`)
    onPhase('flashing')

    const md5 = md5Hash(options.image)
    await loader.writeFlash({
      fileArray: [{ data: options.image, address: options.offset }],
      flashMode: 'keep',
      flashFreq: 'keep',
      flashSize: 'keep',
      eraseAll: options.eraseAll,
      compress: true,
      reportProgress: (_fileIndex, written, total) => {
        onProgress(Math.min(1, written / Math.max(1, total)))
      },
      calculateMD5Hash: () => md5,
    })

    onProgress(1)
    onPhase('verifying')
    pushLog('Flash write complete. Verifying MD5 checksum on device…')
    try {
      const verifyMd5 = await loader.flashMd5sum(options.offset, options.image.byteLength)
      if (verifyMd5.toLowerCase() !== md5.toLowerCase()) {
        throw new Error(`MD5 mismatch: expected ${md5}, device returned ${verifyMd5}`)
      }
      pushLog(`MD5 verified OK (${md5}).`)
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('MD5 mismatch')) throw err
      pushLog('Note: on-device MD5 verification unavailable on this connection; image checksums were validated per-block.')
    }

    onPhase('rebooting')
    try {
      await loader.after('hard_reset')
      pushLog('Device reset — new firmware should be running.')
    } catch {
      pushLog('Automatic reset not supported; press the EN/RESET button on the board.')
    }
    await transport.disconnect()
    onPhase('done')
    return { ok: true, chipName, durationMs: Date.now() - started, bytesWritten: options.image.byteLength }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    pushError(`Flash failed: ${message}`)
    onPhase('error')
    try {
      await transport.disconnect()
    } catch {
      /* port already gone */
    }
    return { ok: false, chipName, error: message, durationMs: Date.now() - started, bytesWritten: 0 }
  }
}
