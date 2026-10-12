/*
 * PUNARVA — ESP32 battery-tester firmware (reference implementation)
 * ===================================================================
 *
 * Implements the documented wire protocol from docs/HARDWARE_INTEGRATION.md:
 * one JSON object per line at 115200 baud, >= 4 Hz:
 *
 *   {"voltage_v":3.72,"current_a":0.45,"temperature_c":28.3,"timestamp":"2026-10-10T14:32:05.250Z"}
 *
 * Board: ESP32 DevKit V1 (classic)
 * Sensing: ADS1115 16-bit I2C ADC (addr 0x48) for voltage + current channels,
 *          DS18B20 (optional) or ADS1115 channel for temperature.
 * Display: SSD1306 128x64 I2C OLED at addr 0x3C (optional — auto-detected).
 *
 * Design rules (mirrors the dashboard's honesty policy):
 *  - Send every sample, one JSON line each; the DASHBOARD validates ranges
 *    and renders gaps. The firmware never fabricates plausible-looking data.
 *  - If a sensor read fails, send `null` for that channel (JSON null keeps the
 *    line parseable, validation rejects it honestly, and the chart shows a
 *    gap for that tick). Keep the timestamp valid: NTP-sync it when WiFi is
 *    configured; otherwise omit timestamp entirely and the dashboard stamps
 *    reception time itself.
 *  - NO load actuation in this firmware. The controlled-load stage is a
 *    separate, future, electrically-protected design (see docs §6).
 *
 * Arduino IDE settings: Board "ESP32 Dev Module", Upload Speed 921600,
 * Flash the app binary at the offset shown by the dashboard's Flash page
 * (classic ESP32 → 0x1000). "Export Compiled Binary" produces the .bin to
 * flash — or use the dashboard's arduino-cli compile path.
 *
 * Libraries (Arduino Library Manager unless bundled):
 *   - Adafruit ADS1X15     (ADS1115 driver)
 *   - Adafruit SSD1306 + Adafruit GFX  (OLED, optional)
 *   - OneWire + DallasTemperature    (DS18B20, optional; remove if unused)
 *   - WiFi + time          (built-in; only needed for NTP timestamps)
 */

#include <Wire.h>
#include <Adafruit_ADS1X15.h>

// -------- Optional modules: comment out if not fitted --------
#define USE_OLED 1          // SSD1306 128x64 at 0x3C
// #define USE_DS18B20 1     // DS18B20 on one-wire pin TEMP_PIN
// #define USE_WIFI_NTP 1    // NTP-synced ISO timestamps require WiFi creds

#if USE_OLED
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#endif

#if defined(USE_DS18B20)
#include <OneWire.h>
#include <DallasTemperature.h>
#endif

#if defined(USE_WIFI_NTP)
#include <WiFi.h>
#include <time.h>
#endif

// ------------------------------ Pin map ------------------------------
// I2C (ADS1115 + OLED). Adjust for your wiring.
constexpr int PIN_SDA = 21;
constexpr int PIN_SCL = 22;

// Analog fallback channels (ESP32 internal ADC) if ADS1115 absent.
constexpr int PIN_ADC_VOLTAGE = 34;   // ADC1_CH6, input-only
constexpr int PIN_ADC_CURRENT = 35;   // ADC1_CH7, input-only

#if defined(USE_DS18B20)
constexpr int PIN_ONEWIRE = 4;
OneWire oneWire(PIN_ONEWIRE);
DallasTemperature tempSensor(&oneWire);
#endif

// --------------------------- Sample timing ---------------------------
constexpr uint32_t SAMPLE_INTERVAL_MS = 250;   // 4 Hz — matches the dashboard's expected cadence
constexpr uint32_t SERIAL_BAUD = 115200;

// --------------------- Sense chain scaling factors -------------------
// TODO(calibration): replace with your measured divider/shunt constants.
// The dashboard rejects values outside ±1…1000 V, −100…100 A, −50…200 °C.
// Voltage divider example: 100k top / 10k bottom from a 12 V battery → ×11.
constexpr float VOLTAGE_SCALE = 11.0f;   // raw_v → battery volts
// Current shunt example: 0.01 Ω shunt through the ADS1115 gain amplifier.
constexpr float CURRENT_SCALE = 1.0f;    // raw_a → amperes
constexpr float TEMP_SCALE = 1.0f;       // raw_c → °C

// ------------------------------- State -------------------------------
Adafruit_ADS1115 ads;
bool adsOk = false;

#if USE_OLED
Adafruit_SSD1306 oled(128, 64, &Wire, -1);
bool oledOk = false;
#endif

uint32_t lastSampleMs = 0;
uint32_t sampleCount = 0;

#if defined(USE_WIFI_NTP)
// Fill in to get real ISO-8601 device timestamps; otherwise leave timestamp
// out of the payload and the dashboard substitutes reception time (flagged).
const char* WIFI_SSID = "your-ssid";
const char* WIFI_PASS = "your-password";
const char* NTP_POOL = "pool.ntp.org";
constexpr long GMT_OFFSET_S = 0;
constexpr int DST_OFFSET_S = 0;
bool timeSynced = false;
#endif

// ------------------------------ Helpers ------------------------------

static float readVoltage() {
  if (adsOk) {
    // AIN0 after divider. ADS1115 ±4.096 V range, 128 SPS for low noise.
    int16_t raw = ads.readADC_SingleEnded(0);
    float raw_v = ads.computeVolts(raw);
    return raw_v * VOLTAGE_SCALE;
  }
  uint32_t acc = 0;
  for (int i = 0; i < 8; i++) acc += analogRead(PIN_ADC_VOLTAGE);   // cheap averaging
  float raw_v = (acc / 8.0f) * 3.3f / 4095.0f;                     // internal ADC, 12-bit
  return raw_v * VOLTAGE_SCALE * (3.3f / 3.3f);                    // keep scale explicit
}

static float readCurrent() {
  if (adsOk) {
    int16_t raw = ads.readADC_SingleEnded(1);
    float raw_v = ads.computeVolts(raw);
    // Shunt + amplifier chain assumed to make raw_v == amps × CURRENT_SCALE.
    return raw_v * CURRENT_SCALE;
  }
  uint32_t acc = 0;
  for (int i = 0; i < 8; i++) acc += analogRead(PIN_ADC_CURRENT);
  float raw_v = (acc / 8.0f) * 3.3f / 4095.0f;
  return raw_v * CURRENT_SCALE;
}

static float readTemperature() {
#if defined(USE_DS18B20)
  tempSensor.requestTemperatures();
  float c = tempSensor.getTempCByIndex(0);
  return c;   // DEVICE_DISCONNECTED_C propagates as a huge negative → dashboard rejects, honest
#else
  // No sensor fitted: report the ADS1115 die-agnostic placeholder channel raw
  // truthfully — send a null instead. The dashboard renders a gap, not a guess.
  return NAN;
#endif
}

#if defined(USE_WIFI_NTP)
static String isoNow() {
  struct tm t;
  if (!getLocalTime(&t, 5)) return String();
  char buf[32];
  time_t now = mktime(&t);
  struct tm utc;
  gmtime_r(&now, &utc);
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &utc);
  return String(buf);
}
#endif

static void sendSample(float v, float i, float temp) {
  // One JSON object per line. NaN channels become JSON null — the dashboard's
  // validation treats missing channel data honestly and charts render gaps.
  Serial.print(F("{\"voltage_v\":"));
  if (isnan(v)) Serial.print(F("null")); else Serial.print(v, 4);
  Serial.print(F(",\"current_a\":"));
  if (isnan(i)) Serial.print(F("null")); else Serial.print(i, 4);
  Serial.print(F(",\"temperature_c\":"));
  if (isnan(temp)) Serial.print(F("null")); else Serial.print(temp, 2);
#if defined(USE_WIFI_NTP)
  String ts = isoNow();
  if (ts.length() > 0) {
    Serial.print(F(",\"timestamp\":\""));
    Serial.print(ts);
    Serial.print(F("\""));
  }
#endif
  Serial.println(F("}"));
}

static void updateOled(float v, float i, float temp) {
#if USE_OLED
  if (!oledOk) return;
  oled.clearDisplay();
  oled.setTextSize(1);
  oled.setTextColor(SSD1306_WHITE);
  oled.setCursor(0, 0);
  oled.print(F("PUNARVA tester"));
  oled.setCursor(0, 16);
  if (isnan(v)) oled.print(F("V: --")); else { oled.print(F("V: ")); oled.print(v, 3); oled.print(F(" V")); }
  oled.setCursor(0, 28);
  if (isnan(i)) oled.print(F("I: --")); else { oled.print(F("I: ")); oled.print(i, 3); oled.print(F(" A")); }
  oled.setCursor(0, 40);
  if (isnan(temp)) oled.print(F("T: --")); else { oled.print(F("T: ")); oled.print(temp, 1); oled.print(F(" C")); }
  oled.setCursor(0, 54);
  oled.print(F("n=")); oled.print(sampleCount);
  oled.display();
#else
  (void)v; (void)i; (void)temp;
#endif
}

// ------------------------------- Setup -------------------------------

void setup() {
  Serial.begin(SERIAL_BAUD);
  delay(1500);   // let the USB-UART bridge settle before first line
  Serial.println();

  Wire.begin(PIN_SDA, PIN_SCL);

  // ADS1115 at 0x48; fall back to internal ADC pins if missing.
  adsOk = ads.begin(0x48);
  if (adsOk) {
    ads.setGain(GAIN_SIXTEEN);   // ±0.256 V FS — suited to shunt + divider stages
    ads.setDataRate(RATE_ADS1115_128SPS);
  }
  Serial.print(F("[punarva] ADS1115: "));
  Serial.println(adsOk ? "ok" : "not found — using internal ADC");

#if USE_OLED
  oledOk = oled.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  if (oledOk) {
    oled.clearDisplay();
    oled.setTextSize(1);
    oled.setTextColor(SSD1306_WHITE);
    oled.setCursor(0, 0);
    oled.print(F("PUNARVA booting…"));
    oled.display();
  }
  Serial.print(F("[punarva] OLED: "));
  Serial.println(oledOk ? "ok" : "not found");
#endif

#if defined(USE_DS18B20)
  tempSensor.begin();
#endif

#if defined(USE_WIFI_NTP)
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  for (int i = 0; i < 20 && WiFi.status() != WL_CONNECTED; i++) delay(500);
  configTime(GMT_OFFSET_S, DST_OFFSET_S, NTP_POOL);
  timeSynced = WiFi.status() == WL_CONNECTED;
#endif

  analogReadResolution(12);
  pinMode(PIN_ADC_VOLTAGE, INPUT);
  pinMode(PIN_ADC_CURRENT, INPUT);
}

// ------------------------------- Loop --------------------------------

void loop() {
  const uint32_t now = millis();
  if (now - lastSampleMs < SAMPLE_INTERVAL_MS) return;
  lastSampleMs = now;

  const float v = readVoltage();
  const float i = readCurrent();
  const float t = readTemperature();

  sendSample(v, i, t);
  sampleCount++;
  updateOled(v, i, t);
}
