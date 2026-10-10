/**
 * Safe storage wrapper. Browser storage (localStorage) can be unavailable —
 * private mode, disabled, quota errors, embedded webviews. The app must
 * degrade to in-memory storage and tell the user, never crash.
 */

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  clear(): void
  key(index: number): string | null
  readonly length: number
}

class MemoryStorage implements StorageLike {
  private map = new Map<string, string>()
  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }
  removeItem(key: string): void {
    this.map.delete(key)
  }
  clear(): void {
    this.map.clear()
  }
  get length(): number {
    return this.map.size
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null
  }
}

function createMemoryStorage(): StorageLike {
  return new MemoryStorage()
}

export type StorageMode = 'local' | 'memory'

export interface StorageProbe {
  storage: StorageLike
  mode: StorageMode
}

/** Probe localStorage once; fall back to an in-memory shim. */
export function probeStorage(): StorageProbe {
  try {
    const k = '__punarva_probe__'
    window.localStorage.setItem(k, '1')
    window.localStorage.removeItem(k)
    return { storage: window.localStorage, mode: 'local' }
  } catch {
    return { storage: createMemoryStorage(), mode: 'memory' }
  }
}

/** Best-effort byte size of a stored key (UTF-16 → ~2 bytes/char). */
export function storageBytes(storage: StorageLike, key: string): number {
  const v = storage.getItem(key)
  return v === null ? 0 : v.length * 2
}
