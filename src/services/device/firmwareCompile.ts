/**
 * Client for the arduino-cli compile bridge, which runs embedded in the Vite
 * dev server (same origin — no separate process, no CORS). Compiles the
 * bundled firmware sketch from the repo OR a user-supplied C++/Arduino source
 * file into a flashable .bin.
 *
 * Endpoints (provided by the plugin in vite.config.ts):
 *   GET  /__punarva/health          → { arduinoCli, fqbn }
 *   POST /__punarva/compile         → compiles firmware/punarva_tester
 *   POST /__punarva/compile-source  → compiles { fileName, cpp } from the body
 *
 * The bridge only exists in the dev server; the production build serves no
 * compile endpoints and the UI explains the alternatives then.
 */

const BRIDGE_BASE = '/__punarva'

export interface BridgeHealth {
  reachable: boolean
  arduinoCli: boolean
  fqbn?: string
}

export interface CompileResult {
  ok: boolean
  fileName?: string
  data?: Uint8Array
  /** Flash write offset the bridge recommends for this image (merged images → 0). */
  flashOffset?: number | null
  log?: string
  error?: string
}

export const BRIDGE_DEV_ONLY = true

export async function bridgeHealth(): Promise<BridgeHealth> {
  try {
    const res = await fetch(`${BRIDGE_BASE}/health`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return { reachable: false, arduinoCli: false }
    const body = (await res.json()) as { arduinoCli: boolean; fqbn?: string }
    return { reachable: true, arduinoCli: body.arduinoCli, fqbn: body.fqbn }
  } catch {
    return { reachable: false, arduinoCli: false }
  }
}

function parseCompileBody(body: { ok: boolean; fileName?: string; binBase64?: string; flashOffset?: number | null; log?: string; error?: string }): CompileResult {
  if (!body.ok || !body.binBase64) {
    return { ok: false, error: body.error ?? 'Compilation failed — inspect the log.', log: body.log }
  }
  const bytes = Uint8Array.from(atob(body.binBase64), (c) => c.charCodeAt(0))
  return { ok: true, fileName: body.fileName, data: bytes, flashOffset: body.flashOffset, log: body.log }
}

/** Compile the bundled firmware/punarva_tester sketch. */
export async function compileFirmware(
  onLog?: (line: string) => void,
  onStage?: (stage: 'checking' | 'compiling' | 'done') => void,
): Promise<CompileResult> {
  onStage?.('checking')
  const health = await bridgeHealth()
  if (!health.reachable) {
    return {
      ok: false,
      error:
        'Compile bridge not available. In development it runs inside `npm run dev`. For production, use the Arduino IDE: open firmware/punarva_tester and Sketch → Export Compiled Binary, then flash the exported .bin.',
    }
  }
  if (!health.arduinoCli) {
    return {
      ok: false,
      error:
        'The bridge is running but arduino-cli was not found on its PATH. Install arduino-cli (e.g. `brew install arduino-cli`), restart `npm run dev`, or use the Arduino IDE export instead.',
    }
  }

  onStage?.('compiling')
  onLog?.(`Compiling sketch for ${health.fqbn ?? 'esp32:esp32:esp32'}… (this can take a minute on first build)`)
  try {
    const res = await fetch(`${BRIDGE_BASE}/compile`, { method: 'POST', signal: AbortSignal.timeout(600_000) })
    const body = (await res.json()) as Parameters<typeof parseCompileBody>[0]
    const result = parseCompileBody(body)
    if (result.log) onLog?.(result.log)
    if (result.ok) {
      onStage?.('done')
      onLog?.(`Compiled: ${result.fileName} (${result.data?.byteLength.toLocaleString() ?? '?'} bytes)`)
      if (result.flashOffset !== null && result.flashOffset !== undefined) {
        onLog?.(`Recommended write offset: 0x${result.flashOffset.toString(16).toUpperCase()}`)
      }
    }
    return result
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Compile a user-supplied C++/Arduino source file. Built as its own sketch
 * (name derived from the uploaded file) so it never mixes with the bundled
 * firmware build.
 */
export async function compileUserSource(fileName: string, source: string): Promise<CompileResult> {
  const health = await bridgeHealth()
  if (!health.reachable) {
    return {
      ok: false,
      error:
        'Compile bridge not available. In development it runs inside `npm run dev`. Alternatively compile in the Arduino IDE and flash the exported .bin.',
    }
  }
  if (!health.arduinoCli) {
    return {
      ok: false,
      error: 'The bridge is running but arduino-cli was not found on its PATH. Install arduino-cli and restart `npm run dev`.',
    }
  }
  try {
    const res = await fetch(`${BRIDGE_BASE}/compile-source`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, cpp: source }),
      signal: AbortSignal.timeout(600_000),
    })
    const body = (await res.json()) as Parameters<typeof parseCompileBody>[0]
    const result = parseCompileBody(body)
    if (result.ok && result.flashOffset !== null && result.flashOffset !== undefined) {
      result.log = (result.log ?? '') + `\nRecommended write offset: 0x${result.flashOffset.toString(16).toUpperCase()}`
    }
    return result
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
