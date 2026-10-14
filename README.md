<div align="center">

# ⚡ PUNARVA

### *Every Battery Has More Life.*

**A premium battery intelligence & diagnostics platform — engineering prototype**

[![React](https://img.shields.io/badge/React-19-35233F?style=flat-square&logo=react&logoColor=FF936B)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-35233F?style=flat-square&logo=typescript&logoColor=63D8C2)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6-35233F?style=flat-square&logo=vite&logoColor=FF936B)](https://vite.dev)
[![Three.js](https://img.shields.io/badge/Three.js-R3F-35233F?style=flat-square&logo=threedotjs&logoColor=63D8C2)](https://r3f.docs.pmnd.rs)
[![Tailwind](https://img.shields.io/badge/Tailwind-3.4-35233F?style=flat-square&logo=tailwindcss&logoColor=FF936B)](https://tailwindcss.com)
[![Prototype](https://img.shields.io/badge/Status-Engineering_Prototype-FF936B?style=flat-square)](#-honesty--scope)

</div>

---

**PUNARVA** is the software interface for an ESP32-based battery testing prototype. It combines a cinematic 3D product visualization, a professional battery-laboratory aesthetic, and a *real, working* diagnostics workflow — test state machine, live charts, engineering reports, history, and CSV export — built to ingest honest measurements from hardware the moment that hardware is validated.

> 🔋 **KNOW YOUR BATTERY. BEFORE IT FAILS.**

---

## ✨ Screenshots

| Overview — cinematic 3D hero | Battery Check — live demo test |
| --- | --- |
| ![Overview dashboard with 3D battery and tester](docs/screenshots/overview.png) | ![Battery Check running a demo test with scanning ring](docs/screenshots/battery-check-testing.png) |

| Technology — interactive 3D assembly | Technology — honest component statuses |
| --- | --- |
| ![Interactive 3D tester assembly](docs/screenshots/technology-assembly.png) | ![Component list with development statuses](docs/screenshots/technology-components.png) |

---

## 🚀 Quick start

```bash
# 1. Install dependencies (Node 18+)
npm install

# 2. Run the development server
npm run dev          # → http://localhost:5173
#    (with arduino-cli on PATH, the Flash page's compile buttons just work)

# 3. Production build & preview
npm run build
npm run preview      # → http://localhost:4173
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload **+ embedded C++ compile bridge** |
| `npm run build` | Type-check (`tsc -b`) **and** production build — CI-safe |
| `npm run lint` | ESLint over the whole project |
| `npm run preview` | Serve the production build locally |
| `npm run smoke:md5` | Verify the flash-image MD5 helper against Node's crypto |

---

## 🧭 What's inside

| Route | Screen | Highlights |
| --- | --- | --- |
| `/` | **Overview** | WebGL hero: conceptual battery + PUNARVA tester with red/black test leads, live metric cards, response charts, recent tests, connection panel, system event log |
| `/battery-check` | **Battery Check** | Full test workflow `IDLE → PRE-CHECKS → READY → TESTING → PROCESSING → RESULTS` (+ `DISCONNECTED`, `ERROR`), 15 s / 30 s / 60 s / 2 min durations, scanning-ring 3D animation, live charts |
| `/results/:id` | **Test report** | Engineering report: min/max/avg statistics, response curves, completeness, data-quality warnings, CSV export, **reference comparison** (observed deltas vs. a chosen baseline — never a health verdict) |
| `/history` | **Test History** | Search + filters (source, status, **date range**, **sort**), local persistence, per-record reports, CSV import/export, storage honesty banner |
| `/technology` | **Technology** | Clickable signal-flow diagram, interactive 3D component assembly, per-component development status |
| `/about` | **Project Information** | Problem, solution, 5-stage workflow, current vs. future development |
| `/settings` | **Settings** | Device connection (Web Serial **or WebSocket bridge**), payload protocol, motion preferences, storage management, browser support |
| `/flash` | **Flash Firmware** | Browser-based ESP32 flashing via esptool-js over Web Serial: .bin upload **or** one-click C++ compile (arduino-cli), board/offset/baud settings, progress stepper, live bootloader log, MD5 verification, auto-reset |

### Feature checklist

- 🎨 **Plum / copper / sea-glass-teal design system** — no generic black-and-white; layered gradients, fine technical grids, restrained glow
- 🧊 **Real WebGL 3D** (Three.js + React Three Fiber + Drei) — procedural battery, tester, display with live readout texture, energy pulses, scanning ring; graceful fallback when WebGL is unavailable
- 📈 **Recharts instrumentation** — voltage / current / temperature vs. time with units, tooltips, and *visible gaps for missing samples*
- 🧪 **A real test engine** — duplicate-start protection, complete timer cleanup, partial-data reports when stopped, deterministic 4 Hz sampling
- 💾 **Persistent history** with graceful in-memory fallback when browser storage is unavailable
- 📤 **CSV export & validated import** — exports contain the actual samples; imports are strictly validated with precise errors
- 🔌 **Modular device layer** — Web Serial transport **+ WebSocket bridge transport** (same JSON-line protocol over ws://), strict payload validation, staleness/rejection handling
- ⚡ **Flash firmware from the browser** — esptool-js over Web Serial: detect chip, write at the right offset, verify MD5, reset; no Python or esptool.py install needed
- 🧑‍💻 **C++ → .bin in one click** — the Vite dev server embeds an arduino-cli compile bridge (`/__punarva/*`): compile the bundled `firmware/punarva_tester` protocol sketch **or any uploaded `.ino`/`.cpp`**, then flash the result
- 📡 **Reference ESP32 firmware in C++** — `firmware/punarva_tester/punarva_tester.ino` streams the documented JSON measurement protocol (ADS1115, optional OLED/DS18B20/NTP); protocol-complete, awaiting hardware validation
- 📏 **Calibration groundwork** — set a completed test as a comparison baseline; reports show observed deltas against it (same chemistry & duration enforced), explicitly *not* state-of-health
- ♿ **Accessibility & performance** — visible focus states, keyboard navigation, `prefers-reduced-motion` respected in CSS *and* in the 3D scene
- 📱 **Responsive** — sidebar collapses into a drawer on mobile; layouts verified at laptop/tablet/phone widths

---

## 🏗 Architecture at a glance

```
Battery under test → Test probes → Voltage/current sensing → ESP32 + ADS1115
                                                            ↓
                            Display / dashboard ← Measurement processing
```

Software side:

```
src/
├─ components/          # UI kit, layout shell, 3D scenes, charts, domain widgets
│  ├─ three/            # BatteryTesterScene, TesterAssemblyScene, WebGL guard & fallback
│  ├─ charts/           # Recharts time-series with honest gaps
│  └─ …
├─ pages/               # One component per route (incl. FlashPage — firmware flashing)
├─ state/               # Zustand stores + the TestEngine state machine
├─ services/            # Device transports (Web Serial + WebSocket), validation, esptool-js
│  └─ device/           #   flasher, firmwareCompile client, MD5 helper, transports
├─ data/                # Component catalogue, chemistries
└─ lib/                 # Formatting, IDs, class helpers
firmware/
└─ punarva_tester/      # Reference ESP32 C++ sketch (JSON measurement protocol)
```

Flashing & compilation live in **`vite.config.ts`** (dev-only plugin serving
`/__punarva/health`, `/__punarva/compile`, `/__punarva/compile-source` with
arduino-cli) and **`src/services/device/flasher.ts`** (esptool-js over Web
Serial). The compile bridge runs only while `npm run dev` runs.

Deep dives live in [`docs/`](docs):

- 📘 [Architecture](docs/ARCHITECTURE.md) — stack, state model, data flow, design system
- 🔌 [Hardware integration](docs/HARDWARE_INTEGRATION.md) — how the ESP32 will talk to this dashboard
- 📄 [CSV format](docs/CSV_FORMAT.md) — export/import schemas and validation rules

---

## 🧪 Verified before shipping

The following were executed and passed on the shipped code:

- ✅ `npm run build` — TypeScript strict check + Vite production build, zero errors
- ✅ `npm run lint` — zero errors
- ✅ `npm run smoke:md5` — flash MD5 helper matches Node's crypto on all vectors
- ✅ C++ compile pipeline, end-to-end: bundled sketch **and** an uploaded user `.cpp` both produce flashable images through `/__punarva/compile-source`; compiler errors surface verbatim in the UI
- ✅ Missing arduino-cli library → explicit `fatal error: Foo.h` message in the Flash page; resolved with `arduino-cli lib install`
- ✅ Full demo test run in a real browser: start → pre-checks → ready → testing (4 Hz samples) → processing → results
- ✅ Stop/reset controls, duplicate-start protection, timer cleanup
- ✅ CSV export fires a real download; history records persist and re-open
- ✅ All routes render; invalid result IDs and unknown routes show clean empty states
- ✅ WebGL scenes render in-browser; the non-WebGL fallback path is code-reviewed and isolated

---

## 🪪 Honesty & scope

This is an **engineering prototype**, and the software is deliberate about what it does *not* claim:

- 🔴 **No device is connected by default.** Without hardware, every measurement on screen comes from a clearly labelled simulation — banners, badges, and chart tags all say **DEMO / SIMULATED**.
- 🚫 **The website can never actuate a physical load.** Load control requires validated firmware, a safe protocol, and electrical protection that do not exist yet.
- 🧾 **No fabricated intelligence.** Reports never show state-of-health, internal resistance, remaining capacity, safety certification, or failure predictions. Until a validated estimator exists, reports state:
  > *Battery health assessment unavailable — validated test data and calibration required.*
- 🗄 **Browser storage ≠ MicroSD.** Local records are explicitly labelled as browser-local; device records appear only after an explicit CSV import.
- 🧊 **The 3D models are conceptual**, not manufacturing-accurate CAD.

---

## 🗺 Roadmap

| Stage | Item | Status |
| --- | --- | --- |
| 1 | Reference ESP32 acquisition firmware (protocol-complete C++) | 🟡 Provided in `firmware/` — awaiting hardware validation |
| 1 | ESP32 + ADS1115 acquisition bring-up | 🟡 Under development — needs physical hardware validation |
| 1 | Browser flashing + C++ compile path | ✅ Implemented (Web Serial + arduino-cli bridge) |
| 1 | WebSocket device bridge transport | ✅ Implemented (unverified against real bridge) |
| 1 | Voltage-sensing circuit finalisation | 🟡 Under development — hardware design task |
| 2 | Current / temperature sensors, OLED, MicroSD logging | 🟡 Firmware support shipped (ADS1115 channels, DS18B20 optional, SSD1306 optional, MicroSD CSV logging in dashboard-import format) — awaiting hardware validation |
| 2 | Controlled-load stage (with protection) | ⚪ Planned — requires validated firmware, hardware protection, and electrical review; deliberately not exposed to software |
| 3 | Calibration & repeatable testing | 🟡 Reference-test comparison + user-entered gain/offset sensor corrections (applied to hardware readings only, provenance noted in reports) |
| 3 | Validated battery-health estimation | ⚪ Planned — deliberately not fabricated before validated data exists |
| 4 | AI/ML analysis after sufficient real data | ⚪ Planned — needs real dataset first |
| 4 | Second-life evaluation support | ⚪ Planned — depends on validated health estimation |

---

<div align="center">

**PUNARVA** — built for *Innovation Day* 🔬

*Measure honestly. Report transparently. Every battery has more life.*

</div>
