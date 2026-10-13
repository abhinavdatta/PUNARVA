# PUNARVA firmware

Reference ESP32 firmware for the battery tester prototype. It streams the
dashboard's documented protocol: one JSON object per line at 115200 baud, ≥ 4 Hz:

```json
{"voltage_v":3.72,"current_a":0.45,"temperature_c":28.3,"timestamp":"2026-10-10T14:32:05.250Z"}
```

> Structure illustration only — the firmware sends measured values, never fabricated ones.

## What's implemented

- **ADS1115** (I2C 0x48) for voltage + current channels; falls back to the ESP32's internal ADC pins (GPIO34/35) if the ADS1115 is missing.
- **SSD1306 OLED** (I2C 0x3C, optional) shows live V/I/T and sample count.
- **DS18B20** temperature (optional; enable `USE_DS18B20`).
- **MicroSD logging** (SPI, CS=GPIO5, enabled by default) — every sample is appended to `/punarva_log.csv` in the dashboard's documented CSV import format (`test_id,t_offset_ms,voltage_v,current_a,temperature_c`, empty cells for missing values). Copy the file off the card and import it via **Test History → Import CSV**; a fresh `PVR-DEV-…` test id is generated per boot.
- **NTP timestamps** (optional; enable `USE_WIFI_NTP` and fill in credentials) — otherwise the dashboard stamps reception time and flags it.
- Failed sensor reads become JSON `null` — the dashboard renders honest gaps.
- **No load actuation.** The controlled-load stage is a separate future design (see `docs/HARDWARE_INTEGRATION.md §6`).

## Wiring defaults (edit to match your build)

| Signal | Pin |
| --- | --- |
| I2C SDA | GPIO 21 |
| I2C SCL | GPIO 22 |
| ADC voltage (fallback) | GPIO 34 |
| ADC current (fallback) | GPIO 35 |
| OneWire (DS18B20) | GPIO 4 |
| MicroSD CS (VSPI: SCK 18 / MISO 19 / MOSI 23) | GPIO 5 |

Scaling constants (`VOLTAGE_SCALE`, `CURRENT_SCALE`, `TEMP_SCALE`) are placeholders — replace with your measured divider/shunt values.

## Compile & flash

**Option A — from this dashboard (no IDE):**

The compile bridge runs **inside the Vite dev server** (plugin in
`vite.config.ts`) — there is no separate process to start:

```bash
# requires arduino-cli on PATH (https://arduino.cc/arduino-cli)
npm run dev
```

Then open the dashboard's **Flash Firmware** page → *"Compile bundled
sketch"* (this sketch) or *"Compile your C++ file…"* (any `.ino`/`.cpp`).
The compiled image appears in step 1, ready to flash over Web Serial.

> The bridge is **dev-only**: it exists while `npm run dev` runs. Production
> builds (`npm run build && npm run preview`) serve no compile endpoints — use
> the Arduino IDE path below when not developing.

**Option B — Arduino IDE:**

1. Open `firmware/punarva_tester/punarva_tester.ino` (the `.ino` folder must keep that name).
2. Board: **ESP32 Dev Module**.
3. Install libraries: **Adafruit ADS1X15**, **Adafruit SSD1306**, **Adafruit GFX** (+ **OneWire**, **DallasTemperature** if used). The SD/SPI libraries ship with the ESP32 core.
4. Sketch → **Export Compiled Binary**.
5. Flash the produced `.bin` via the dashboard's **Flash Firmware** page → "Choose firmware file…".

## Honesty notes

- This firmware is a reference implementation: compile-ready and protocol-complete, but **not yet validated against real instrument-grade hardware**. Calibration constants must be measured before trusting absolute values.
- The dashboard still labels everything: demo data stays `DEMO`, validated device streams become `HARDWARE`, MicroSD transfers arrive only via explicit CSV import as `IMPORTED`.
