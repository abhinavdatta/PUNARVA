# PUNARVA — Deployment (Cloudflare Workers)

The dashboard is a client-side SPA with no server-side data dependency, so it
hosts on **Cloudflare Workers static assets** with single-page-application
fallback. A minimal Worker entry handles the tooling endpoints honestly.

---

## 1. What "compatible with Cloudflare Workers" means here

| Concern | Status on Workers | How |
| --- | --- | --- |
| Dashboard UI, charts, 3D, test workflow | ✅ Fully works | `dist/` served from static assets (`wrangler.jsonc → assets.directory`) |
| Client-side routes (`/battery-check`, `/results/<id>`, …) | ✅ Deep links work | `not_found_handling: "single-page-application"` |
| Web Serial device connection | ✅ Works | Browser API — needs desktop Chrome/Edge/Opera on the deployed HTTPS origin |
| Firmware flashing (Flash page) | ✅ Works | Also browser-side (esptool-js over Web Serial) |
| arduino-cli compile bridge | ❌ Local-dev only | It shells out to `arduino-cli`, which a Workers runtime cannot do — the Worker returns a precise 503 with guidance |
| Test history (localStorage) | ✅ Works | Client-side; per-browser as always |
| Secrets | ✅ None needed | The app ships no secrets and needs none |

## 2. Files added for Workers

```
wrangler.jsonc      # config: assets dir, SPA fallback, ASSETS binding, worker entry
worker/index.ts     # /__punarva/* → honest 503; everything else → assets (SPA fallback)
```

`worker/index.ts` is included in `tsconfig.node.json`, so `npm run build`
type-checks it together with `vite.config.ts`.

## 3. Deploy

```bash
npx wrangler login        # one-time browser authentication
npm run deploy            # = npm run build && wrangler deploy
```

First deploy creates a `punarva.<your-subdomain>.workers.dev` URL. Custom
domains can be attached in the Cloudflare dashboard (Workers → punarva →
Settings → Domains & Routes).

## 4. Verify locally before deploying

```bash
npm run cf:dev           # build + wrangler dev → http://localhost:8787
```

Checks worth running (all verified on this repo):

| Request | Expected |
| --- | --- |
| `GET /` | 200, `index.html` |
| `GET /battery-check` (any client route) | 200, `index.html` (SPA fallback) |
| `GET /__punarva/health` | 503 JSON explaining the bridge is dev-only |
| `GET /assets/<chunk>.js` | 200, immutable JS chunk |

## 5. Deployment honesty notes

- The compile bridge **cannot** run on Workers (no local toolchain, no child
  processes). The deployed Flash page says so and points to the Arduino IDE
  export path instead of failing cryptically.
- Nothing about the deployment weakens the safety rule: the Worker is
  stateless and read-only; no endpoint can actuate hardware, and no secrets
  are required or present.
- If a future backend bridge is needed (e.g. relaying ESP32 packets), the
  WebSocket transport already speaks the documented protocol — a Durable
  Object could host that bridge later **without touching the UI** (see
  [HARDWARE_INTEGRATION.md](HARDWARE_INTEGRATION.md)).
