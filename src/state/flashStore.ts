import { create } from 'zustand'
import { useDeviceStore } from '@/state/deviceStore'
import { flashEsp32, defaultOffsetFor, type FlasherOptions } from '@/services/device/flasher'
import { isWebSerialSupported } from '@/services/device/transports'
import { md5Hash } from '@/services/device/flasherMd5'

export type FlashPhase =
  | 'idle'
  | 'loaded'
  | 'requesting-port'
  | 'connecting'
  | 'flashing'
  | 'verifying'
  | 'rebooting'
  | 'done'
  | 'error'

export interface FlashEvent {
  kind: 'log' | 'error'
  text: string
  at: number
}

export interface FlashImage {
  fileName: string
  size: number
  md5: string
  /** Raw image bytes held in memory until a new file is chosen. */
  data: Uint8Array
}

const MAX_LOG_EVENTS = 600

interface FlashState {
  serialSupported: boolean
  phase: FlashPhase
  image: FlashImage | null
  offset: number
  baudrate: number
  chipFamily: FlasherOptions['chipFamily']
  eraseAll: boolean
  progress: number
  events: FlashEvent[]
  error: string | null
  chipName: string | null
  lastDurationMs: number | null

  loadFile: (file: File) => Promise<void>
  loadImageBytes: (data: Uint8Array, fileName: string, flashOffset?: number | null) => void
  clearImage: () => void
  setOffset: (offset: number) => void
  setBaudrate: (baudrate: number) => void
  setChipFamily: (family: FlasherOptions['chipFamily']) => void
  setEraseAll: (erase: boolean) => void
  startFlash: () => Promise<void>
  reset: () => void
}

export const useFlashStore = create<FlashState>()((set, get) => ({
  serialSupported: isWebSerialSupported(),
  phase: 'idle',
  image: null,
  offset: 0x1000,
  baudrate: 921600,
  chipFamily: 'auto',
  eraseAll: false,
  progress: 0,
  events: [],
  error: null,
  chipName: null,
  lastDurationMs: null,

  loadFile: async (file) => {
    try {
      const data = new Uint8Array(await file.arrayBuffer())
      const image: FlashImage = { fileName: file.name, size: data.byteLength, md5: md5Hash(data), data }
      set({ image, phase: 'loaded', progress: 0, error: null, events: [] })
      useDeviceStore.getState().pushEvent('info', `Firmware image loaded: ${file.name} (${data.byteLength.toLocaleString()} bytes)`)
      if (get().chipFamily === 'auto') set({ offset: defaultOffsetFor('ESP32') })
    } catch {
      const error = `Could not read ${file.name}.`
      set({ phase: 'error', error })
      useDeviceStore.getState().pushEvent('error', error)
    }
  },

  loadImageBytes: (data, fileName, flashOffset?: number | null) => {
    const image: FlashImage = { fileName, size: data.byteLength, md5: md5Hash(data), data }
    set({ image, phase: 'loaded', progress: 0, error: null, events: [] })
    // A merged image is a complete flash layout (bootloader + partitions + app):
    // it must be written at 0x0, not at the app-partition offset.
    if (flashOffset !== null && flashOffset !== undefined) {
      set({ offset: flashOffset })
    } else if (fileName.endsWith('.merged.bin')) {
      set({ offset: 0 })
    } else if (fileName.endsWith('.ino.bin') || fileName.endsWith('.bin')) {
      set({ offset: defaultOffsetFor('ESP32') })
    }
    useDeviceStore.getState().pushEvent('info', `Firmware image loaded: ${fileName} (${data.byteLength.toLocaleString()} bytes)`)
  },

  clearImage: () => set({ image: null, phase: 'idle', progress: 0, events: [], error: null }),

  setOffset: (offset) => set({ offset: Math.max(0, offset) }),
  setBaudrate: (baudrate) => set({ baudrate: Math.max(9600, baudrate) }),
  setChipFamily: (chipFamily) =>
    set((s) => ({ chipFamily, offset: chipFamily === 'auto' ? defaultOffsetFor('ESP32') : s.offset })),
  setEraseAll: (eraseAll) => set({ eraseAll }),

  startFlash: async () => {
    const state = get()
    if (!state.image) return
    if (state.phase !== 'loaded' && state.phase !== 'error' && state.phase !== 'done') return

    set({ phase: 'requesting-port', progress: 0, error: null, events: [], chipName: null })
    const onEvent = (event: FlashEvent) =>
      set((s) => ({ events: [...s.events, event].slice(-MAX_LOG_EVENTS) }))

    // esptool's own chatter lands in `events`; progress + phase drive the UI.
    const result = await flashEsp32({
      image: state.image.data,
      fileName: state.image.fileName,
      offset: state.offset,
      baudrate: state.baudrate,
      eraseAll: state.eraseAll,
      chipFamily: state.chipFamily,
      onEvent,
      onProgress: (fraction) => set({ progress: fraction }),
      onPhase: (phase) => set({ phase }),
    })

    if (result.ok) {
      set({ chipName: result.chipName, lastDurationMs: result.durationMs })
      useDeviceStore.getState().pushEvent(
        'info',
        `Firmware flashed to ${result.chipName ?? 'device'} in ${(result.durationMs / 1000).toFixed(1)}s.`,
      )
    } else {
      set({ error: result.error ?? 'Flashing failed.', lastDurationMs: result.durationMs })
      useDeviceStore.getState().pushEvent('error', `Flash failed — ${result.error ?? 'unknown error'}`)
    }
  },

  reset: () =>
    set({
      phase: 'idle',
      progress: 0,
      events: [],
      error: null,
      chipName: null,
      lastDurationMs: null,
    }),
}))
