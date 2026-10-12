import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { probeStorage } from '@/services/storage/safeStorage'
import type { ReferenceInfo } from '@/services/calibration'

interface CalibrationState {
  reference: ReferenceInfo | null
  setReference: (ref: ReferenceInfo | null) => void
}

const { storage } = probeStorage()

export const useCalibrationStore = create<CalibrationState>()(
  persist(
    (set) => ({
      reference: null,
      setReference: (reference) => set({ reference }),
    }),
    {
      name: 'punarva.calibration.v1',
      storage: createJSONStorage(() => storage),
    },
  ),
)
