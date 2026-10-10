# PUNARVA — Architecture

This document describes how the PUNARVA dashboard is built, why it is structured
this way, and how data flows through it.

---

## 1. Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | **React 19 + TypeScript (strict)** | Typed, componentised UI; strict mode catches whole classes of bugs at build time |
| Build | **Vite 6** | Fast dev server, simple production builds, chunk splitting |
| Styling | **Tailwind CSS 3.4** with a custom theme | The plum/copper/teal palette is defined once in `tailwind.config.ts` and used everywhere |
| 3D | **Three.js + @react-three/fiber + drei** | Real WebGL scenes as React components; custom environment (no CDN fetches) |
| Charts | **Recharts** | Declarative time-series charts with tooltips, units, and gap rendering |
| State | **Zustand** (with `persist`) | Small, typed stores; persistence with a safe-storage fallback |
| Routing | **React Router 6** | SPA routes matching the sidebar navigation |
| Fonts | `@fontsource-variable/inter`, `@fontsource-variable/space-grotesk` | Self-hosted — the app works fully offline, no font CDN |

---

## 2. Module boundaries

```
┌────────────────────────────── UI layer ──────────────────────────────┐
│ pages/            route components (Overview, BatteryCheck, …)       │
│ components/       layout shell · UI kit · 3D scenes · charts ·       │
│                   dashboard widgets · results report                 │
└───────────────▲──────────────────────────────────────────▲───────────┘
                │ reads via hooks                          │ calls actions
┌───────────────┴──────────── state layer ────┴───────────┴───────────┐
│ state/testStore + testEngine    the battery-test state machine       │
│ state/deviceStore               connection status, readings, events  │
│ state/historyStore              persisted test records               │
│ state/settingsStore             motion preference                    │
└───────────────▲──────────────────────────────────────────▲───────────┘
                │                                          │
┌───────────────┴───────── services layer ────┴───────────┴───────────┐
│ services/device/transports   Web Serial transport (swappable)       │
│ services/validation          payload validation + staleness         │
│ services/demo/sampler        labelled demo measurement model        │
│ services/csv                 export / strict import                 │
│ services/storage/safeStorage localStorage with memory fallback      │
│ services/records             record building + statistics           │
└──────────────────────────────────────────────────────────────────────┘
```

The rule enforced throughout: **UI never talks to hardware or data plumbing
directly** — it reads stores, and stores/services own the logic. This is what
makes the future ESP32 link a drop-in rather than a rewrite.

---

## 3. The test engine (`src/state/testEngine.ts`)

A singleton state machine driving the workflow:

```
IDLE ──► PRE-CHECKS ──► READY ──► TESTING ──► PROCESSING ──► RESULTS
  ▲          │ fail        │                          │
  │          ▼             │ stop                     ▼
  └────── ERROR / DISCONNECTED ◄───────────────── (partial record kept)
```

Guarantees implemented in code:

- **Duplicate-start protection** — `start()` rejects when any active phase is running.
- **No leaked timers** — every `setTimeout`/`setInterval` is tracked in a set and
  cleared on stop, completion, reset, and page unload.
- **4 Hz sampling** — `SAMPLE_INTERVAL_MS = 250`; expected samples derive from the
  chosen duration (`durationS × 4`).
- **Two sample sources, one policy:**
  - `DEMO` → values come from `DemoSampler` (seeded, reproducible, ~1.5 % ticks
    deliberately dropped to exercise completeness handling), and *every* consumer
    labels them as simulated.
  - `HARDWARE` → values come **only** from validated readings received via the
    device store. Ticks without a fresh validated reading stay `null`. The engine
    never invents a measurement.
- **Honest completion** — stopping mid-test finalises a *partial* record flagged
  `stopped`; completing builds the full record with statistics and warnings.

---

## 4. Data flow

```
DemoSampler ──────────┐
                      ├─► testStore.samples ─► charts / metric cards / report
DeviceTransport ─► validateReading ─► deviceStore.lastReading
                                        │
                                        └─► topbar "last valid" indicator
```

- A `Sample` is `{ t, voltage_v|null, current_a|null, temperature_c|null }`.
  `null` means *no valid measurement at this tick* — charts render gaps, the
  report's completeness percentage counts them, and warnings explain them.
- `buildRecord()` computes min/max/avg per channel, completeness, and warnings,
  producing the immutable `TestRecord` that is rendered by the report, stored in
  history, and exported to CSV **unchanged**.

---

## 5. Persistence

| Key | Content | Fallback |
| --- | --- | --- |
| `punarva.history.v1` | Test records | In-memory store + visible banner when `localStorage` is unavailable |
| `punarva.settings.v1` | Motion preference | Not critical |

`probeStorage()` runs once at startup; if `localStorage` throws (private mode,
disabled, embedded webview), a memory shim takes over and the UI tells the user
records are session-only. A soft size limit (~3.5 MB) raises a *persist warning*
suggesting a CSV backup before the browser's real quota is hit.

---

## 6. 3D scenes

`components/three/` contains two independent scenes plus shared plumbing:

- **`BatteryTesterScene`** — the hero/test visualization: procedural battery
  (rounded case, label texture, terminals), the PUNARVA tester (enclosure,
  live canvas-texture display, buttons, jacks, vents), red/black leads built
  from `CatmullRomCurve3` → `TubeGeometry`, energy pulses, the scanning ring
  (visible only while testing), particles, and a custom `Environment` made of
  `Lightformer`s (keeps metallic materials lively **without fetching an HDR
  from a CDN**).
- **`TesterAssemblyScene`** — the clickable conceptual interior: PCB, ESP32
  module, ADS1115, sensing parts, OLED, ghosted "planned" parts, probe
  connections. Selection is shared with the signal-flow diagram and component
  list via a single `selectedId`.
- **`SceneGuard`** — one-time WebGL capability detection plus an error boundary;
  both scenes degrade to a clean, styled fallback that keeps the rest of the
  app fully functional.
- All display/label text is drawn onto **canvas textures** rather than using
  troika text (which fetches a font at runtime) — offline-safe by construction.
- Motion: `useMotionEnabled()` combines the user's Settings override with the
  OS `prefers-reduced-motion` setting; when motion is reduced the scenes disable
  auto-rotate, particles, and pulses. CSS has a matching global media query.

---

## 7. Design system

Defined in `tailwind.config.ts` + `src/index.css`:

| Token | Value | Use |
| --- | --- | --- |
| `plum-900 / 700` | `#24172F` / `#35233F` | Page background / elevated panels |
| `copper-500` | `#FF936B` | Primary actions, highlights, voltage-free accents |
| `sea-400` | `#63D8C2` | Measurement traces, teal accents |
| `ivory` / `lavender` | `#FFF4EB` / `#C7B7CC` | Primary / secondary text |
| `amber-400`, `critical-500` | warnings, errors | Status colours only |

Reusable primitives: `.panel`, `.tech-grid`, `.label-caps`, `Button`, `Card`,
`Badge`, `StatusDot`, `ProgressBar`, `Modal`, fields, `EmptyState`. Icons are
**Lucide** everywhere — no emoji stand-ins, no missing glyphs.
