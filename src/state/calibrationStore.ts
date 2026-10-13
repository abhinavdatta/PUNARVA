import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { probeStorage } from '@/services/storage/safeStorage'
import type { ReferenceInfo } from '@/services/calibration'

/** gain * raw + offset, applied to incoming HARDWARE readings only. */
export interface ChannelCalibration {
  gain: number
  offset: number
}

export interface SensorCalibration {
  voltage_v: ChannelCalibration
  current_a: ChannelCalibration
  temperature_c: ChannelCalibration
}

export const IDENTITY_CALIBRATION: SensorCalibration = {
  voltage_v: { gain: 1, offset: 0 },
  current_a: { gain: 1, offset: 0 },
  temperature_c: { gain: 1, offset: 0 },
}

export function isIdentityCalibration(c: SensorCalibration): boolean {
  return (
    c.voltage_v.gain === 1 && c.voltage_v.offset === 0 &&
    c.current_a.gain === 1 && c.current_a.offset === 0 &&
    c.temperature_c.gain === 1 && c.temperature_c.offset === 0
  )
}

/** Human-readable summary for event logs and warnings, e.g. "V ×1.003 −0.012". */
export function describeCalibration(c: SensorCalibration): string {
  const f = (name: string, ch: ChannelCalibration): string => {
    const gainStr = ch.gain === 1 ? '' : ` ×${ch.gain}`
    const offStr = ch.offset === 0 ? '' : ` ${ch.offset > 0 ? '+' : ''}${ch.offset}`
    return (gainStr + offStr) === '' ? '' : `${name}${gainStr}${offStr}`
  }
  return [f('V', c.voltage_v), f('A', c.current_a), f('°C', c.temperature_c)]
    .filter((s) => s !== '')
    .join(', ')
}

interface CalibrationState {
  reference: ReferenceInfo | null
  sensor: SensorCalibration
  setReference: (ref: ReferenceInfo | null) => void
  setSensor: (sensor: SensorCalibration) => void
  resetSensor: () => void
}

const { storage } = probeStorage()

export const useCalibrationStore = create<CalibrationState>()(
  persist(
    (set) => ({
      reference: null,
      sensor: IDENTITY_CALIBRATION,
      setReference: (reference) => set({ reference }),
      setSensor: (sensor) => set({ sensor }),
      resetSensor: () => set({ sensor: IDENTITY_CALIBRATION }),
    }),
    {
      name: 'punarva.calibration.v1',
      storage: createJSONStorage(() => storage),
      // Older persisted state has no `sensor` key — keep identity calibration.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<CalibrationState>
        return {
          ...current,
          ...p,
          sensor: p.sensor ?? IDENTITY_CALIBRATION,
        }
      },
    },
  ),
)
