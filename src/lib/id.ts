/** Test ID helpers: PVR-YYYYMMDD-HHMMSS-XXXX */

function pad(n: number, len = 2): string {
  return String(n).padStart(len, '0')
}

export function newTestId(at: Date = new Date()): string {
  const date = `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}`
  const time = `${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}`
  const rand = Math.floor(Math.random() * 0xffff)
    .toString(16)
    .toUpperCase()
    .padStart(4, '0')
  return `PVR-${date}-${time}-${rand}`
}

export function shortId(id: string): string {
  const parts = id.split('-')
  return parts.length >= 4 ? `${parts[1]}-${parts[3]}` : id
}
