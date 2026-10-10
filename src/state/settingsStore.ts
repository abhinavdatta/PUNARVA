import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { probeStorage } from '@/services/storage/safeStorage'

export type MotionPreference = 'system' | 'reduced' | 'full'

interface SettingsState {
  /** User override for motion/animation. 'system' follows prefers-reduced-motion. */
  motionOverride: MotionPreference
  setMotionOverride: (p: MotionPreference) => void
}

const { storage } = probeStorage()

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      motionOverride: 'system',
      setMotionOverride: (motionOverride) => set({ motionOverride }),
    }),
    {
      name: 'punarva.settings.v1',
      storage: createJSONStorage(() => storage),
    },
  ),
)
