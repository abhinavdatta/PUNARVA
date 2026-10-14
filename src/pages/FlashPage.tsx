import { useEffect, useRef, useState } from 'react'
import {
  Cpu,
  Cable,
  FileUp,
  Trash2,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  RotateCw,
  Code2,
  Hammer,
  Lock,
} from 'lucide-react'
import { useFlashStore } from '@/state/flashStore'
import { useDeviceStore } from '@/state/deviceStore'
import { bridgeHealth, compileFirmware, compileUserSource, type BridgeHealth } from '@/services/device/firmwareCompile'
import { fmtBytes } from '@/lib/format'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { CodeBlock } from '@/components/ui/CodeBlock'
import { EmptyState } from '@/components/ui/EmptyState'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { cn } from '@/lib/utils'

const PHASE_STEPS: Array<{ id: 'requesting-port' | 'connecting' | 'flashing' | 'verifying' | 'rebooting'; label: string }> = [
  { id: 'requesting-port', label: 'Port' },
  { id: 'connecting', label: 'Bootloader' },
  { id: 'flashing', label: 'Writing' },
  { id: 'verifying', label: 'Verify' },
  { id: 'rebooting', label: 'Reset' },
]

function phaseIndex(phase: string): number {
  const i = PHASE_STEPS.findIndex((s) => s.id === phase)
  return i === -1 ? -1 : i
}

export function FlashPage() {

  const serialSupported = useFlashStore((s) => s.serialSupported)
  const phase = useFlashStore((s) => s.phase)
  const image = useFlashStore((s) => s.image)
  const offset = useFlashStore((s) => s.offset)
  const baudrate = useFlashStore((s) => s.baudrate)
  const chipFamily = useFlashStore((s) => s.chipFamily)
  const eraseAll = useFlashStore((s) => s.eraseAll)
  const progress = useFlashStore((s) => s.progress)
  const events = useFlashStore((s) => s.events)
  const error = useFlashStore((s) => s.error)
  const chipName = useFlashStore((s) => s.chipName)
  const lastDurationMs = useFlashStore((s) => s.lastDurationMs)
  const loadFile = useFlashStore((s) => s.loadFile)
  const clearImage = useFlashStore((s) => s.clearImage)
  const setOffset = useFlashStore((s) => s.setOffset)
  const setBaudrate = useFlashStore((s) => s.setBaudrate)
  const setChipFamily = useFlashStore((s) => s.setChipFamily)
  const setEraseAll = useFlashStore((s) => s.setEraseAll)
  const startFlash = useFlashStore((s) => s.startFlash)
  const reset = useFlashStore((s) => s.reset)

  const deviceConnection = useDeviceStore((s) => s.connection)
  const loadImageBytes = useFlashStore((s) => s.loadImageBytes)
  const [bridge, setBridge] = useState<BridgeHealth>({ reachable: false, arduinoCli: false })
  const [compiling, setCompiling] = useState(false)
  const [compilingName, setCompilingName] = useState<string | null>(null)
  const [compileError, setCompileError] = useState<string | null>(null)
  const [showSketchHelp, setShowSketchHelp] = useState(false)
  const cppInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void bridgeHealth().then(setBridge)
  }, [])

  async function compileUploaded(file: File) {
    setCompileError(null)
    setCompiling(true)
    setCompilingName(file.name)
    try {
      const source = await file.text()
      const result = await compileUserSource(file.name, source)
      if (result.ok && result.data) {
        loadImageBytes(result.data, result.fileName ?? file.name, result.flashOffset)
      } else {
        setCompileError(
          (result.log ? `Compilation errors for ${file.name}:\n${result.log}\n\n` : '') +
            (result.error ?? 'Compilation failed.'),
        )
      }
    } catch (err) {
      setCompileError(`Could not read ${file.name}: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setCompiling(false)
      setCompilingName(null)
    }
  }

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [events.length])

  const busy =
    phase === 'requesting-port' || phase === 'connecting' || phase === 'flashing' || phase === 'verifying' || phase === 'rebooting'
  const currentStep = phaseIndex(phase)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ivory">Flash Firmware</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-lavender/80">
          Write a firmware <code className="font-mono text-xs text-sea-300">.bin</code> image directly to the ESP32's flash —
          entirely from this browser, over Web Serial. No Python or esptool.py install required.
        </p>
      </header>

      {!serialSupported && (
        <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3.5 py-2.5 text-xs leading-relaxed text-amber-400">
          This browser does not expose Web Serial. Use desktop Chrome, Edge, or Opera to flash hardware.
        </p>
      )}

      {deviceConnection === 'connected' && (
        <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3.5 py-2.5 text-xs leading-relaxed text-amber-400">
          A device connection is active in Settings. Close it there before flashing — only one program can hold the serial port.
        </p>
      )}

      {/* -------------------------- 1 · Firmware file -------------------------- */}
      <Card>
        <CardHeader
          title="1 · Firmware image"
          icon={<FileUp aria-hidden />}
          subtitle="A compiled ESP32 application binary (.bin) — e.g. Arduino IDE “Export Compiled Binary” or an idf.py build artifact"
          actions={image && <Badge tone="plum">{fmtBytes(image.size)}</Badge>}
        />
        <CardBody className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".bin,application/octet-stream"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void loadFile(file)
              e.target.value = ''
            }}
          />

          {!image ? (
            <EmptyState
              icon={<FileUp />}
              title="No firmware image loaded"
              description="Choose a .bin file. It stays in this browser tab's memory only; nothing is uploaded to any server."
              action={
                <Button variant="primary" onClick={() => fileInputRef.current?.click()} disabled={busy}>
                  Choose firmware file…
                </Button>
              }
            />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sea-400/30 bg-sea-400/8 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ivory">{image.fileName}</p>
                <p className="numeric mt-0.5 text-[11px] text-lavender/70">
                  {fmtBytes(image.size)} · MD5 <span className="font-mono">{image.md5.slice(0, 12)}…</span>
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} disabled={busy}>
                <RotateCw className="h-3.5 w-3.5" aria-hidden /> Replace
              </Button>
            </div>
          )}

          {image && (
            <Button variant="ghost" size="sm" onClick={clearImage} disabled={busy}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove image
            </Button>
          )}
        </CardBody>
      </Card>

      {/* --------------------- 1b · Firmware source (C++) --------------------- */}
      <Card>
        <CardHeader
          title="1b · Or compile the bundled C++ firmware"
          icon={<Code2 aria-hidden />}
          subtitle="Compile the bundled protocol sketch (firmware/punarva_tester), or upload your own .ino/.cpp file and flash it directly."
          actions={
            <Badge tone={bridge.arduinoCli ? 'teal' : bridge.reachable ? 'amber' : 'neutral'}>
              {bridge.arduinoCli ? 'arduino-cli ready' : bridge.reachable ? 'bridge running · no cli' : 'bridge offline'}
            </Badge>
          }
        />
        <CardBody className="space-y-3">
          <input
            ref={cppInputRef}
            type="file"
            accept=".ino,.cpp,.h,.hpp,text/plain"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) void compileUploaded(file)
            }}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="teal"
              loading={compiling && compilingName === null}
              disabled={busy || compiling}
              onClick={async () => {
                setCompileError(null)
                setCompiling(true)
                setCompilingName(null)
                const result = await compileFirmware()
                setCompiling(false)
                setCompilingName(null)
                if (result.ok && result.data) {
                  loadImageBytes(result.data, result.fileName ?? 'punarva_tester.bin', result.flashOffset)
                } else {
                  setCompileError(result.error ?? 'Compilation failed.')
                }
              }}
            >
              <Hammer className="h-4 w-4" aria-hidden /> Compile bundled sketch
            </Button>
            <Button
              variant="secondary"
              loading={compiling && compilingName !== null}
              disabled={busy || compiling}
              onClick={() => cppInputRef.current?.click()}
            >
              <Code2 className="h-4 w-4" aria-hidden /> Compile your C++ file…
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowSketchHelp((v) => !v)}>
              How does this work?
            </Button>
          </div>

          {compiling && compilingName && (
            <p className="text-xs text-lavender/70">Compiling {compilingName}… this can take a minute.</p>
          )}

          {compileError && (
            <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3.5 py-2.5 text-xs leading-relaxed text-amber-400 whitespace-pre-wrap">
              {compileError}
            </p>
          )}

          {showSketchHelp && (
            <details open className="mt-1">
              <div className="mt-2">
                <CodeBlock
                  code={`# The compile bridge runs INSIDE the dev server
# (vite.config.ts plugin) — nothing extra to start.
npm run dev
# ↑ with arduino-cli on PATH, compile buttons just work.

# Production build: the bridge is dev-only. Compile via the
# Arduino IDE instead:
#   1. Open firmware/punarva_tester/punarva_tester.ino
#   2. Board: "ESP32 Dev Module"
#   3. Sketch → Export Compiled Binary
#   4. Flash the .bin with "Choose firmware file…" above`}
                />
              </div>
            </details>
          )}
        </CardBody>
      </Card>

      {/* -------------------------- 2 · Flash settings ------------------------- */}
      <Card>
        <CardHeader
          title="2 · Flash settings"
          icon={<Cpu aria-hidden />}
          subtitle="Defaults match a classic ESP32 (ESP32-WROOM) board. Only change these if you know your board differs."
        />
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="label-caps mb-1.5 block">Board family</span>
              <select
                value={chipFamily}
                onChange={(e) => setChipFamily(e.target.value as typeof chipFamily)}
                disabled={busy}
                className="w-full rounded-lg border border-plum-500/70 bg-plum-800/80 px-3 py-2 text-sm text-ivory"
              >
                <option value="ESP32">ESP32 (classic)</option>
                <option value="ESP32-S2">ESP32-S2</option>
                <option value="ESP32-S3">ESP32-S3</option>
                <option value="ESP32-C3">ESP32-C3</option>
              </select>
              <span className="mt-1 block text-[11px] text-lavender/60">
                Classic ESP32 app binaries flash at 0x1000; S2/S3/C3 at 0x0.
              </span>
            </label>

            <label className="block">
              <span className="label-caps mb-1.5 block">Write offset</span>
              <input
                type="text"
                inputMode="numeric"
                value={`0x${offset.toString(16).toUpperCase().padStart(4, '0')}`}
                onChange={(e) => {
                  const parsed = Number.parseInt(e.target.value, 16)
                  if (!Number.isNaN(parsed)) setOffset(parsed)
                }}
                disabled={busy}
                className="numeric w-full rounded-lg border border-plum-500/70 bg-plum-800/80 px-3 py-2 font-mono text-sm text-ivory"
              />
              <span className="mt-1 block text-[11px] text-lavender/60">Bootloader offset — normally leave as preset.</span>
            </label>

            <label className="block">
              <span className="label-caps mb-1.5 block">Baud rate</span>
              <select
                value={baudrate}
                onChange={(e) => setBaudrate(Number(e.target.value))}
                disabled={busy}
                className="w-full rounded-lg border border-plum-500/70 bg-plum-800/80 px-3 py-2 text-sm text-ivory"
              >
                {[115200, 230400, 460800, 921600].map((rate) => (
                  <option key={rate} value={rate}>
                    {rate.toLocaleString()} baud
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[11px] text-lavender/60">Higher = faster; drop to 115200 if unstable.</span>
            </label>
          </div>

          <label className="flex items-start gap-2.5 rounded-lg border border-plum-500/50 bg-plum-800/40 px-3.5 py-3">
            <input
              type="checkbox"
              checked={eraseAll}
              onChange={(e) => setEraseAll(e.target.checked)}
              disabled={busy}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <span className="text-sm font-semibold text-ivory">Erase entire flash first</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-lavender/70">
                Wipes NVS / calibration and any stored test records on the device. Slower, but guarantees a clean install.
              </span>
            </span>
          </label>
        </CardBody>
      </Card>

      {/* ----------------------------- 3 · Flash it ---------------------------- */}
      <Card>
        <CardHeader
          title="3 · Flash"
          icon={<Zap aria-hidden />}
          subtitle="The browser will ask you to pick the board's serial port. Hold BOOT if the board is running firmware that uses the port."
          actions={
            <Badge tone={busy ? 'copper' : image && !busy ? 'teal' : 'neutral'}>
              {busy ? 'Working' : phase === 'done' ? 'Complete' : phase === 'error' ? 'Failed' : 'Ready'}
            </Badge>
          }
        />
        <CardBody className="space-y-4">
          <div aria-hidden className="flex items-center gap-1">
            {PHASE_STEPS.map((step, i) => {
              const state = currentStep > i || phase === 'done' ? 'done' : currentStep === i ? 'active' : 'pending'
              return (
                <div key={step.id} className="flex flex-1 flex-col items-center gap-1.5">
                  <div
                    className={cn(
                      'h-1.5 w-full rounded-full transition-colors',
                      state === 'done' && 'bg-sea-400/70',
                      state === 'active' && 'bg-copper-400 animate-pulse',
                      state === 'pending' && 'bg-plum-600/50',
                    )}
                  />
                  <span
                    className={cn(
                      'text-[10px] font-semibold uppercase tracking-wider',
                      state === 'done' && 'text-sea-300',
                      state === 'active' && 'text-copper-400',
                      state === 'pending' && 'text-lavender/40',
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              )
            })}
          </div>

          {(busy || phase === 'done') && (
            <div className="space-y-1.5">
              <ProgressBar value={phase === 'done' ? 1 : progress} tone={phase === 'done' ? 'teal' : 'copper'} label="Flash progress" />
              <p className="numeric text-right text-[11px] text-lavender/70">
                {phase === 'done' ? '100%' : `${Math.round(progress * 100)}%`}
                {chipName ? ` · ${chipName}` : ''}
                {lastDurationMs !== null && phase === 'done' ? ` · ${(lastDurationMs / 1000).toFixed(1)}s` : ''}
              </p>
            </div>
          )}

          {phase === 'error' && error && (
            <p className="rounded-lg border border-critical-500/30 bg-critical-500/10 px-3.5 py-2.5 text-xs leading-relaxed text-critical-400">
              <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />
              {error}
            </p>
          )}

          {phase === 'done' && (
            <p className="rounded-lg border border-sea-400/30 bg-sea-400/8 px-3.5 py-2.5 text-xs leading-relaxed text-sea-300">
              <CheckCircle2 className="mr-1.5 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />
              Firmware flashed and verified. The board was reset — open Settings → “Connect device” to stream measurements
              from the new firmware.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="lg"
              loading={busy}
              disabled={!image || !serialSupported || busy || deviceConnection === 'connected'}
              onClick={() => void startFlash()}
            >
              <Zap className="h-4 w-4" aria-hidden />
              {busy ? 'Flashing…' : 'Flash to ESP32…'}
            </Button>
            <Button variant="ghost" onClick={reset} disabled={busy}>
              Clear log
            </Button>
          </div>

          {!image && !busy && (
            <p className="text-xs leading-relaxed text-lavender/60">
              <Lock className="mr-1.5 inline h-3 w-3 align-[-1px]" aria-hidden />
              Flash unlocks once a firmware image is loaded — compile the bundled sketch above or choose a .bin file in step 1.
            </p>
          )}
          {!serialSupported && !busy && (
            <p className="text-xs leading-relaxed text-lavender/60">
              Web Serial is unavailable in this browser — flashing also stays disabled here.
            </p>
          )}

          <p className="flex items-start gap-2 rounded-lg border border-plum-500/50 bg-plum-800/50 px-3.5 py-3 text-xs leading-relaxed text-lavender/85">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sea-400" aria-hidden />
            Flashing writes only the firmware you chose, at the offset above, to the board you picked in the browser's
            port dialog. If the write is interrupted, the previous firmware stays intact until the bootloader region is
            touched.
          </p>
        </CardBody>
      </Card>

      {/* ------------------------------ Log console ---------------------------- */}
      <Card>
        <CardHeader title="Bootloader log" icon={<Cable aria-hidden />} subtitle="Live output from the esptool flash session" />
        <CardBody>
          {events.length === 0 ? (
            <EmptyState
              icon={<Cable />}
              title="No flash session yet"
              description="Bootloader connection details, write progress, and verification results will appear here."
            />
          ) : (
            <div
              ref={logRef}
              className="max-h-80 overflow-y-auto rounded-lg border border-plum-600/70 bg-plum-950/70 p-4 font-mono text-xs leading-relaxed"
            >
              {events.map((event, i) => (
                <p
                  key={i}
                  className={cn(
                    'whitespace-pre-wrap break-all',
                    event.kind === 'error' ? 'text-critical-400' : 'text-sea-300/90',
                  )}
                >
                  {event.text}
                </p>
              ))}
            </div>
          )}
          <details className="mt-4">
            <summary className="cursor-pointer text-xs font-semibold text-lavender/80 hover:text-ivory">
              What happens during flashing?
            </summary>
            <div className="mt-2">
              <CodeBlock
                code={`1. The browser asks you to select the ESP32's serial port (Web Serial).
2. esptool resets the chip into its ROM download mode (or you hold BOOT).
3. A small flasher stub is uploaded to RAM for fast writes.
4. Your .bin image is written at the chosen offset, compressed.
5. The image MD5 is verified against the on-device checksum.
6. The board is hard-reset and runs the new firmware.`}
              />
            </div>
          </details>
        </CardBody>
      </Card>
    </div>
  )
}
