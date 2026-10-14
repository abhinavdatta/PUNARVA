# PUNARVA — Hardware Integration Guide

How the ESP32 prototype will feed measurements into this dashboard, what is
already prepared on the software side, and what must exist before any physical
actuation is even discussable.

---

## 1. Current status (honest)

| Capability | Status |
| --- | --- |
| Dashboard ingest layer (validation, staleness, events) | ✅ Implemented |
| Web Serial transport (Chrome/Edge/Opera desktop) | ✅ Implemented, unverified against real hardware |
| WebSocket bridge transport (same protocol over ws://) | ✅ Implemented, unverified against real bridges |
| Browser-based ESP32 firmware flashing (esptool-js) | ✅ Implemented, unverified against real hardware |
| C++ → .bin compile bridge (arduino-cli, optional local helper) | ✅ Implemented |
| Reference ESP32 firmware source (`firmware/punarva_tester`) | ✅ Provided, not yet validated on hardware |
| Documented wire protocol | ✅ Implemented (see below) |
| Demo data source (clearly labelled) | ✅ Implemented |
| Validated ESP32 firmware producing this protocol | ❌ Not yet — under development |
| Controlled-load actuation from software | ❌ **Deliberately absent** — see §6 |

Until real firmware streams validated readings, the dashboard runs on demo data
and says so everywhere.

---

## 2. Transport

The dashboard supports **Web Serial** out of the box
(`src/services/device/transports.ts`):

- Baud: **115200**
- Framing: **one JSON object per line** (`\n`-terminated, UTF-8)
- Flow: user clicks *Connect device* → `navigator.serial.requestPort()` →
  `port.open({ baudRate: 115200 })` → read loop splits lines → `JSON.parse` →
  validation

A WebSocket bridge (`src/services/device/webSocketTransport.ts`) already
implements the same `DeviceTransport` interface (`connect`, `disconnect`,
`onRaw/onError/onClose`) — no UI changes are needed to use it.

Error handling covered by the UI:

| Condition | Behaviour |
| --- | --- |
| Browser without Web Serial | Connect disabled + explanatory notice (Settings, Overview, Battery Check) |
| Port selection cancelled | Error event, status returns to disconnected |
| Port busy / cannot open | Precise error text in Connection panel + event log |
| Malformed line | Counted as rejected payload, `error` event, never displayed as data |
| Stream ends unexpectedly | Status → disconnected with reason |
| Stale readings (no fresh payload > 5 s) | "Last valid" timestamp stops refreshing; hardware pre-check fails |

---

## 3. Wire protocol

### 3.1 Transports

The dashboard offers two read-only transports, both feeding the same validation
path:

| Transport | Where | Use |
| --- | --- | --- |
| **Web Serial** | direct USB, desktop Chrome/Edge/Opera | ESP32 plugged into the machine running the dashboard |
| **WebSocket bridge** | `Settings → Device connection → WebSocket bridge`, default `ws://localhost:8765` | ESP32 far from the dashboard machine; any small bridge process relays its serial JSON lines over ws:// |

A reference bridge is not required to be fancy: read serial lines, send each
line as a WebSocket text message. The dashboard handles single values and
newline-delimited batches alike.

### 3.2 Payload

One JSON object per line:

```json
{"voltage_v": 3.72, "current_a": 0.45, "temperature_c": 28.3, "timestamp": "2026-10-10T14:32:05.250Z"}
```

> The values above illustrate **structure only** — they are not real readings.

Field rules enforced by `src/services/validation.ts`:

| Field | Type | Plausible range |
| --- | --- | --- |
| `voltage_v` | finite number | −1 … 1000 |
| `current_a` | finite number | −100 … 100 |
| `temperature_c` | finite number | −50 … 200 |
| `timestamp` | ISO-8601 string | optional — if missing/unparsable, reception time is used **and the payload is flagged** |

Anything failing range/type checks is rejected loudly (event log + rejected
counter) and never reaches a chart. A firmware sketch should therefore send
exactly one line per sample, e.g.:

```cpp
// Pseudocode — not a validated firmware example
Serial.print("{\"voltage_v\":");  Serial.print(adcToVolts(raw));
Serial.print(",\"current_a\":");  Serial.print(shuntAmps(raw));
Serial.print(",\"temperature_c\":"); Serial.print(sensorTemp());
Serial.print(",\"timestamp\":\""); Serial.print(isoNow());
Serial.println("\"}");
```

---

## 4. Running a hardware test

1. Flash firmware that streams the protocol above continuously (≥ 4 Hz).
2. Open **Settings → Device connection → Connect device…**, pick the port.
3. The top bar flips to **HARDWARE** and "last valid" starts ticking.
4. On **Battery Check**, pre-checks now include: device connected, fresh
   validated readings present, and zero rejected payloads.
5. During the test the interface animates workflow state only — samples appear
   strictly from received readings; ticks without fresh data stay empty and are
   reported as missing. **No simulated value is ever mixed in.**

---

## 5. MicroSD data

The reference firmware (`firmware/punarva_tester`, `USE_SD` enabled) now logs
every sample to `/punarva_log.csv` in the dashboard's documented CSV sample
format (see [CSV_FORMAT.md](CSV_FORMAT.md)). The dashboard will **never**
pretend browser storage and the card are the same thing:

1. Copy the card's log off the device (it is already in the sample format;
   other logging modules should export/convert to match).
2. **Test History → Import CSV.** The file is strictly validated; invalid
   structure produces a precise error.
3. Imported records are labelled `IMPORTED` and clearly distinguished from demo
   and hardware records.

---

## 5b. Sensor calibration

**Settings → Calibration** accepts user-entered gain/offset corrections
(`corrected = gain × raw + offset`) per channel. Rules enforced in code:

| Behaviour | Implementation |
| --- | --- |
| Corrections apply to **live hardware readings only** | Applied in `deviceStore.ingestRaw` after validation; demo data and imported records are untouched |
| Validation runs on the **raw** payload first | Calibration cannot reshape nonsense into plausibility |
| Records note when calibration was active | `testEngine.complete()` appends a provenance warning naming the applied corrections |
| Reconnecting with active calibration announces it | `warn` event on connect, listing the corrections |
| Values are bounded | Gains clamped to 0.01–10, offsets to ±100 (typo guard) |

Calibration corrects instrument bias — it does **not** validate the sensing
chain or make values certified.

---

## 6. Safety boundary — read this before wiring anything

- The website **cannot** and **must not** actuate a physical load. There is no
  write path in the transport, no actuation endpoint, and none will be added
  until all of the following exist:
  - validated firmware with a signed/acknowledged command protocol,
  - hardware current limiting, fusing, and thermal protection,
  - an electrical review of the load stage.
- Until then, the only safe "test" is passive observation of a battery through
  the sensing chain.
- No secrets, API keys, or tokens belong in this frontend; the device layer
  contains none and none may be added.
