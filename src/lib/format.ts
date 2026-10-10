/** Formatting helpers. All formatters degrade to an em dash for missing data. */

const MISSING = '—'

export function fmtNum(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return MISSING
  return v.toFixed(digits)
}

export function fmtUnit(v: number | null | undefined, unit: string, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return MISSING
  return `${v.toFixed(digits)} ${unit}`
}

export function fmtPct(fraction: number | null | undefined, digits = 1): string {
  if (fraction === null || fraction === undefined || !Number.isFinite(fraction)) return MISSING
  return `${(fraction * 100).toFixed(digits)}%`
}

/** 75 → "01:15" */
export function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return MISSING
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return MISSING
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return MISSING
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return MISSING
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function relativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return MISSING
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return MISSING
  const delta = Math.round((now - t) / 1000)
  if (delta < 2) return 'just now'
  if (delta < 60) return `${delta}s ago`
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`
  return `${Math.floor(delta / 86400)}d ago`
}

export function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}
