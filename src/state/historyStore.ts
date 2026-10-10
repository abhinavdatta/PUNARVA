import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { TestRecord } from '@/types'
import { probeStorage, storageBytes, type StorageMode } from '@/services/storage/safeStorage'

const STORAGE_KEY = 'punarva.history.v1'
/** Warn before we get anywhere near a typical ~5 MB localStorage budget. */
const SOFT_LIMIT_BYTES = 3_500_000

interface HistoryState {
  records: TestRecord[]
  storageMode: StorageMode
  persistWarning: boolean
  addRecord: (record: TestRecord) => void
  removeRecord: (id: string) => void
  clearAll: () => void
  dismissPersistWarning: () => void
}

const probe = probeStorage()

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      records: [],
      storageMode: probe.mode,
      persistWarning: false,

      addRecord: (record) => {
        set((s) => ({ records: [record, ...s.records].slice(0, 200) }))
        const bytes = storageBytes(probe.storage, STORAGE_KEY)
        if (probe.mode === 'local' && bytes > SOFT_LIMIT_BYTES) {
          set({ persistWarning: true })
        }
      },

      removeRecord: (id) => set((s) => ({ records: s.records.filter((r) => r.id !== id) })),

      clearAll: () => set({ records: [], persistWarning: false }),

      dismissPersistWarning: () => set({ persistWarning: false }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => probe.storage),
    },
  ),
)
