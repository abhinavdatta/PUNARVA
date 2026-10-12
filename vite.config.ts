import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'

// https://vite.dev/config/
//
// The arduino-cli compile bridge runs as an embedded Vite dev-server plugin:
// it starts with `npm run dev`, stops with the dev server, and shares the same
// port (no second process to babysit). Endpoints are served under /__punarva/
// so no CORS handling is needed — same-origin fetches from the dashboard.

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)))
const BUILD_PATH = join(PROJECT_ROOT, '.arduino-build')
const USER_SKETCH_ROOT = join(BUILD_PATH, 'user-sketches')
const FQBN = process.env.PUNARVA_FQBN ?? 'esp32:esp32:esp32'

function findArduinoCli(): string | null {
  const candidates = process.platform === 'win32' ? ['arduino-cli.exe', 'arduino-cli'] : ['arduino-cli']
  for (const cmd of candidates) {
    const probe = spawnSync(cmd, ['version'], { encoding: 'utf8', timeout: 5000 })
    if (!probe.error && probe.status === 0) return cmd
  }
  return null
}

interface BinInfo {
  path: string
  size: number
  name: string
}

/**
 * Pick the source-of-truth binary an arduino-cli build produced:
 *   1. `<x>.merged.bin` — complete flash layout (bootloader+partitions+app) → flash at 0x0
 *   2. `<sketch>.ino.bin` — bare application image → flash at the app partition offset
 * bootloader/partitions/boot_app0 are never returned on their own.
 */
function pickBin(dir: string, sketchBase: string): BinInfo | null {
  if (!existsSync(dir)) return null
  let merged: BinInfo | null = null
  let app: BinInfo | null = null
  const walk = (d: string): void => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name)
      if (entry.isDirectory()) {
        walk(p)
      } else if (entry.name.endsWith('.bin')) {
        if (entry.name.endsWith('.merged.bin') && (merged === null || statSync(p).mtimeMs > statSync(merged.path).mtimeMs)) {
          merged = { path: p, size: statSync(p).size, name: entry.name }
        } else if (entry.name === `${sketchBase}.ino.bin` && (app === null || statSync(p).mtimeMs > statSync(app.path).mtimeMs)) {
          app = { path: p, size: statSync(p).size, name: entry.name }
        }
      }
    }
  }
  walk(dir)
  if (merged !== null) return merged
  if (app !== null) return app
  return null
}

function runCompile(arduinoCli: string, args: string[]): Promise<{ code: number | null; log: string }> {
  return new Promise((resolveP) => {
    const child = spawn(arduinoCli, args, { cwd: PROJECT_ROOT })
    let log = ''
    child.stdout?.on('data', (d: Buffer) => {
      log += d.toString()
    })
    child.stderr?.on('data', (d: Buffer) => {
      log += d.toString()
    })
    child.on('error', (err) => resolveP({ code: -1, log: log + String(err) }))
    child.on('close', (code) => resolveP({ code, log }))
  })
}

function compileBridgePlugin(): Plugin {
  let arduinoCli: string | null = null
  return {
    name: 'punarva-compile-bridge',
    configureServer(server) {
      arduinoCli = findArduinoCli()
      server.config.logger.info(
        `  ${arduinoCli ? '✓' : '!'} compile bridge: arduino-cli ${arduinoCli ? 'found' : 'NOT FOUND on PATH'} (fqbn ${FQBN})`,
        { timestamp: true },
      )

      server.middlewares.use('/__punarva/health', (_req, res) => {
        const ok = arduinoCli !== null
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, arduinoCli: ok, fqbn: FQBN }))
      })

      server.middlewares.use('/__punarva/compile', async (req, res) => {
        void req // request body intentionally ignored for the bundled sketch
        if (arduinoCli === null) {
          res.writeHead(503, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: 'arduino-cli not found on PATH (bridge host).' }))
          return
        }
        const sketchDir = join(PROJECT_ROOT, 'firmware', 'punarva_tester')
        if (!existsSync(join(sketchDir, 'punarva_tester.ino'))) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: 'Sketch not found in firmware/punarva_tester.' }))
          return
        }
        mkdirSync(BUILD_PATH, { recursive: true })
        const result = await runCompile(arduinoCli, [
          'compile',
          '--fqbn', FQBN,
          '--output-dir', BUILD_PATH,
          '--build-path', join(BUILD_PATH, 'punarva_tester'),
          sketchDir,
        ])
        if (result.code !== 0) {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: 'Compilation failed — inspect the log.', log: result.log }))
          return
        }
        const bin = pickBin(join(BUILD_PATH, 'punarva_tester'), 'punarva_tester')
        if (bin === null) {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: 'Compilation finished but no .bin was produced.', log: result.log }))
          return
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          ok: true,
          fileName: bin.name,
          size: bin.size,
          flashOffset: bin.name.endsWith('.merged.bin') ? 0 : null,
          binBase64: readFileSync(bin.path).toString('base64'),
          log: result.log,
          fqbn: FQBN,
        }))
      })

      server.middlewares.use('/__punarva/compile-source', async (req, res) => {
        if (arduinoCli === null) {
          res.writeHead(503, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: 'arduino-cli not found on PATH (bridge host).' }))
          return
        }
        let body = ''
        req.on('data', (c: Buffer) => {
          body += c.toString()
          if (body.length > 2 * 1024 * 1024) req.destroy()
        })
        req.on('end', async () => {
          let parsed: { fileName?: unknown; cpp?: unknown }
          try {
            parsed = JSON.parse(body) as { fileName?: unknown; cpp?: unknown }
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: false, error: 'Body must be JSON: { fileName, cpp }' }))
            return
          }
          const cpp = typeof parsed.cpp === 'string' ? parsed.cpp : ''
          if (cpp.length === 0 || cpp.length > 2 * 1024 * 1024) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: false, error: 'Provide the C++/Arduino source as `cpp` (text, ≤ 2 MB).' }))
            return
          }
          const rawName = typeof parsed.fileName === 'string' && parsed.fileName.trim() !== '' ? parsed.fileName.trim() : 'user_sketch.cpp'
          const baseName = rawName.replace(/\.[^.]*$/, '').replace(/[^A-Za-z0-9_]/g, '_').replace(/^_+/, '') || 'user_sketch'
          const sketchDir = join(USER_SKETCH_ROOT, baseName)
          rmSync(sketchDir, { recursive: true, force: true })
          mkdirSync(sketchDir, { recursive: true })
          writeFileSync(join(sketchDir, `${baseName}.ino`), cpp)

          mkdirSync(BUILD_PATH, { recursive: true })
          const result = await runCompile(arduinoCli!, [
            'compile',
            '--fqbn', FQBN,
            '--output-dir', BUILD_PATH,
            '--build-path', join(BUILD_PATH, baseName),
            sketchDir,
          ])
          if (result.code !== 0) {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: false, error: 'Compilation failed — inspect the log.', log: result.log }))
            return
          }
          const bin = pickBin(join(BUILD_PATH, baseName), baseName)
          if (bin === null) {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: false, error: 'Compilation finished but no .bin was produced.', log: result.log }))
            return
          }
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            ok: true,
            fileName: bin.name,
            size: bin.size,
            flashOffset: bin.name.endsWith('.merged.bin') ? 0 : null,
            binBase64: readFileSync(bin.path).toString('base64'),
            log: result.log,
            fqbn: FQBN,
          }))
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), compileBridgePlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three', '@react-three/fiber', '@react-three/drei'],
          charts: ['recharts'],
          vendor: ['react', 'react-dom', 'react-router-dom', 'zustand'],
        },
      },
    },
  },
})
