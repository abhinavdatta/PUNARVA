/// <reference types="@cloudflare/workers-types" />
/**
 * PUNARVA — Cloudflare Worker entry.
 *
 * The built dashboard (dist/) is served directly by the Workers static-assets
 * binding with single-page-application fallback; this handler only sees
 * requests that do NOT match a static file. Two cases matter:
 *
 * 1. `/__punarva/*` — the arduino-cli compile bridge endpoints. That bridge
 *    runs only inside `npm run dev` (it shells out to a locally installed
 *    arduino-cli, which a Workers runtime cannot do). The Worker answers with
 *    a precise 503 so the Flash page shows honest guidance instead of a
 *    confusing JSON-parse error.
 *
 * 2. Client-side routes (`/battery-check`, `/results/<id>`, …) — forwarded to
 *    the assets binding, whose SPA fallback serves index.html.
 *
 * This Worker is deliberately stateless and read-only: consistent with the
 * project's safety rule, there is no path here that could actuate hardware.
 */

interface Env {
  /** Workers static-assets binding (see wrangler.jsonc). */
  ASSETS: {
    fetch: (request: Request) => Promise<Response>
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)

    if (pathname === '/__punarva/health' || pathname.startsWith('/__punarva/')) {
      return jsonResponse(
        {
          ok: false,
          reachable: false,
          arduinoCli: false,
          error:
            'The arduino-cli compile bridge only runs in the local dev server (`npm run dev`). On this deployment, compile with the Arduino IDE (Sketch → Export Compiled Binary) and flash the exported .bin from the Flash page.',
        },
        503,
      )
    }

    // Everything else: serve static assets (SPA fallback for client routes).
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
