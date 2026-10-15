/*
 * PUNARVA - 18650 Battery Health Screening Device
 * ESP32 + ADS1115 + INA219 + SSD1306 OLED + microSD
 *
 * Hardware map matches the Schematik project (battery-health-screening-device-hn5q).
 * Works on arduino-esp32 core 2.x and 3.x. Rename to .ino for Arduino IDE.
 *
 * Verdict LEDs : green = REUSE, yellow = INSPECT, red = RECYCLE
 *                yellow + red together = FAULT (no verdict, fix the setup)
 *                all off after a user STOP = ABORTED
 *
 * !! Before trusting any verdict, calibrate FIXTURE_R_OHMS and VOLTAGE_CAL
 *    (see the comments next to them) and tune the verdict thresholds against
 *    cells whose internal resistance you know. The defaults are starting points.
 */

#include <Arduino.h>
#include <Wire.h>
#include <SPI.h>
#include <SD.h>
#include <Preferences.h>
#include <esp_task_wdt.h>
#include <Adafruit_ADS1X15.h>
#include <Adafruit_INA219.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ------------------------------------------------------------------ pins
constexpr int SD_CS_PIN         = 4;
constexpr int LOAD_GATE_PIN     = 25;
constexpr int START_BUTTON_PIN  = 32;
constexpr int STOP_BUTTON_PIN   = 33;
constexpr int BUZZER_PIN        = 27;
constexpr int REUSE_LED_PIN     = 13;
constexpr int INSPECT_LED_PIN   = 14;
constexpr int RECYCLE_LED_PIN   = 26;
constexpr int BUZZER_LEDC_CH    = 0;   // only used on core 2.x

// ------------------------------------------------------ measurement setup
constexpr float DIVIDER_RATIO = 3.0f;   // 20 k top / 10 k bottom
// Trim against a multimeter: VOLTAGE_CAL = DMM volts / displayed volts (cell at rest).
constexpr float VOLTAGE_CAL   = 1.000f;
// The divider taps the node AFTER the e-stop, fuse and INA219 shunt, so under load
// the ADC sees: Vcell - I * (shunt 0.1 + fuse + e-stop + leads). That series
// resistance is removed in software with this constant.
// Calibrate: load a healthy cell, read the cell terminals with a multimeter
// (V_dmm) and note the raw node voltage (V_raw = node_v column in /tests/*.csv or
// the serial "S" lines; the OLED shows the already-compensated voltage) and current (I):
//     FIXTURE_R_OHMS = (V_dmm - V_raw) / I
// Better fix in hardware: run a dedicated sense wire from the cell holder (+)
// straight to the top of the divider, then set this to ~0.
constexpr float FIXTURE_R_OHMS = 0.20f;

constexpr float NTC_BETA       = 3950.0f;
constexpr float NTC_R0         = 10000.0f;
constexpr float NTC_T0_K       = 298.15f;
constexpr float NTC_FIXED_OHMS = 10000.0f;
constexpr float NTC_SUPPLY_V   = 3.30f;

// ------------------------------------------------------------ test limits
constexpr unsigned long TEST_DURATION_MS  = 30000UL;
constexpr unsigned long SAMPLE_PERIOD_MS  = 250UL;
constexpr unsigned long DISPLAY_PERIOD_MS = 500UL;
constexpr unsigned long IR_SETTLE_MS      = 1000UL;  // resistance is taken at ~1 s
constexpr unsigned long LOAD_CHECK_MS     = 600UL;   // load current must exist by now
constexpr unsigned long MESSAGE_HOLD_MS   = 3000UL;

constexpr float MIN_START_VOLTAGE  = 3.00f;
constexpr float MAX_START_VOLTAGE  = 4.25f;
constexpr float CUTOFF_VOLTAGE     = 2.80f;
constexpr float LOW_SOC_VOLTAGE    = 3.50f;   // below this REUSE is never awarded
constexpr float MAX_CELL_TEMP_C    = 55.0f;
constexpr float MAX_START_TEMP_C   = 40.0f;
constexpr float MAX_CURRENT_A      = 1.40f;   // fuse is 1.5 A
constexpr float MIN_LOAD_CURRENT_A = 0.20f;   // 4.7 ohm load should draw ~0.6-0.9 A
constexpr float IDLE_LEAK_A        = 0.05f;   // current with the MOSFET off
constexpr float REVERSE_CURRENT_A  = -0.05f;  // negative current = reversed cell / backfeed
constexpr float ADC_INPUT_MAX_V    = 1.70f;   // ADS AIN0 above this (cell > ~5.1 V) = divider fault

// ------------------------------------------------- verdict thresholds (tune!)
constexpr float IR_RECYCLE_OHMS     = 0.25f;
constexpr float IR_INSPECT_OHMS     = 0.12f;
constexpr float SAG_INSPECT_V       = 0.30f;  // OCV minus lowest loaded voltage
constexpr float TEMP_RISE_INSPECT_C = 8.0f;

constexpr const char *LOG_PATH = "/punarva.csv";          // one summary row per test
constexpr const char *TESTS_DIR = "/tests";               // /tests/T000001.csv = every sample
constexpr bool REQUIRE_SD_FOR_TEST = true;                // refuse to run (load stays off) without a working card
constexpr unsigned long FLUSH_PERIOD_MS = 2000UL;         // sample file flushed at least this often

// ----------------------------------------------------------------- types
enum class State : uint8_t { IDLE, TESTING, DONE, FAULT };
enum class Verdict : uint8_t { REUSE, INSPECT, RECYCLE, ABORTED, FAULT };
const char *const VERDICT_NAMES[] = {"REUSE", "INSPECT", "RECYCLE", "ABORTED", "FAULT"};

struct Button {
  uint8_t pin;
  bool stableState = HIGH;
  bool lastRaw = HIGH;
  uint32_t lastChangeMs = 0;
  bool pressed = false;  // true for exactly one update() after a debounced press

  explicit Button(uint8_t p) : pin(p) {}
  void begin() {
    pinMode(pin, INPUT_PULLUP);
    lastRaw = stableState = digitalRead(pin);
  }
  void update() {
    pressed = false;
    bool raw = digitalRead(pin);
    if (raw != lastRaw) {
      lastRaw = raw;
      lastChangeMs = millis();
    }
    if (raw != stableState && millis() - lastChangeMs >= 25) {
      stableState = raw;
      if (stableState == LOW) pressed = true;
    }
  }
  bool held() const { return stableState == LOW; }
};

// ---------------------------------------------------------------- globals
Adafruit_ADS1115 ads;
Adafruit_INA219 ina219;
Adafruit_SSD1306 display(128, 64, &Wire, -1);
Preferences prefs;
Button startBtn(START_BUTTON_PIN);
Button stopBtn(STOP_BUTTON_PIN);

bool displayOk = false;
bool sensorsOk = false;
bool sdReady = false;
State state = State::IDLE;

uint32_t testId = 0;
uint32_t testStartedMs = 0;
uint32_t lastSampleMs = 0;
uint32_t lastDisplayMs = 0;
uint32_t messageHoldUntilMs = 0;

float ocvV = 0, minV = 99, peakA = 0, sumA = 0, mAh = 0;
float startTempC = 0, maxTempC = 0, irOhms = 0;
bool irValid = false, cutoffHit = false;
uint32_t sampleCount = 0;

float lastVoltage = 0, lastCurrentA = 0, lastTempC = NAN;
float lastAin0V = 0;                 // raw volts at ADS1115 AIN0 (after the divider)
const char *idleAlarm = nullptr;     // active idle-time alarm, if any

File sampleFile;
bool sampleOpen = false;
uint32_t lastFlushMs = 0;

// ----------------------------------------------------------------- buzzer
struct BeepSeq {
  uint8_t count = 0;
  bool on = false;
  uint32_t nextMs = 0;
  uint16_t freq = 0, onMs = 0, offMs = 0;
} beeps;

void buzzerBegin() {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcAttach(BUZZER_PIN, 2000, 8);
  ledcWriteTone(BUZZER_PIN, 0);
#else
  ledcSetup(BUZZER_LEDC_CH, 2000, 8);
  ledcAttachPin(BUZZER_PIN, BUZZER_LEDC_CH);
  ledcWriteTone(BUZZER_LEDC_CH, 0);
#endif
}

void buzzerTone(uint32_t freq) {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcWriteTone(BUZZER_PIN, freq);
#else
  ledcWriteTone(BUZZER_LEDC_CH, freq);
#endif
}

void startBeeps(uint8_t count, uint16_t freq, uint16_t onMs, uint16_t offMs) {
  beeps.count = count;
  beeps.freq = freq;
  beeps.onMs = onMs;
  beeps.offMs = offMs;
  beeps.on = false;
  beeps.nextMs = 0;
}

void buzzerUpdate() {  // non-blocking
  if (beeps.count == 0 || millis() < beeps.nextMs) return;
  if (!beeps.on) {
    buzzerTone(beeps.freq);
    beeps.on = true;
    beeps.nextMs = millis() + beeps.onMs;
  } else {
    buzzerTone(0);
    beeps.on = false;
    beeps.count--;
    beeps.nextMs = millis() + beeps.offMs;
  }
}

// ---------------------------------------------------------------- sensors
float readAdcVolts(uint8_t channel) {
  int16_t raw = ads.readADC_SingleEnded(channel);
  float v = ads.computeVolts(raw);
  return v < 0.0f ? 0.0f : v;
}

// Raw voltage at the INA219 VIN- node (cell voltage minus series drop under load).
float readNodeVoltage(uint8_t samples = 1) {
  float sum = 0;
  for (uint8_t i = 0; i < samples; i++) sum += readAdcVolts(0);
  lastAin0V = sum / samples;
  return lastAin0V * DIVIDER_RATIO * VOLTAGE_CAL;
}

float readTemperatureC() {
  float node = readAdcVolts(1);
  if (node < 0.05f || node > NTC_SUPPLY_V - 0.05f) return NAN;  // shorted or open NTC
  // Fixed resistor 3.3 V -> node, NTC node -> GND.
  float ntcOhms = NTC_FIXED_OHMS * node / (NTC_SUPPLY_V - node);
  float invT = (1.0f / NTC_T0_K) + logf(ntcOhms / NTC_R0) / NTC_BETA;
  float c = (1.0f / invT) - 273.15f;
  return (c < -20.0f || c > 120.0f) ? NAN : c;
}

float readCurrentA() { return ina219.getCurrent_mA() / 1000.0f; }

// Cheap bus probe: both sensors must still ACK, otherwise readings are stale/garbage.
bool sensorsPresent() {
  Wire.beginTransmission(0x48);  // ADS1115
  if (Wire.endTransmission() != 0) return false;
  Wire.beginTransmission(0x40);  // INA219
  return Wire.endTransmission() == 0;
}

// Estimated cell-terminal voltage with the fixture drop added back.
float cellVoltage(float nodeV, float amps) {
  return nodeV + fmaxf(amps, 0.0f) * FIXTURE_R_OHMS;
}

// ---------------------------------------------------------------- outputs
void endLoad() { digitalWrite(LOAD_GATE_PIN, LOW); }

void setResultLeds(bool reuse, bool inspect, bool recycle) {
  digitalWrite(REUSE_LED_PIN, reuse ? HIGH : LOW);
  digitalWrite(INSPECT_LED_PIN, inspect ? HIGH : LOW);
  digitalWrite(RECYCLE_LED_PIN, recycle ? HIGH : LOW);
}

void drawScreen(const char *status, const char *l5 = "", const char *l6 = "") {
  if (!displayOk) return;
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println(F("PUNARVA 18650 SCREEN"));
  display.println(status);
  display.print(F("V: "));
  display.print(lastVoltage, 2);
  display.println(F(" V"));
  display.print(F("I: "));
  display.print(lastCurrentA, 2);
  display.println(F(" A"));
  display.print(F("T: "));
  if (isnan(lastTempC)) {
    display.println(F("--"));
  } else {
    display.print(lastTempC, 1);
    display.println(F(" C"));
  }
  display.println(l5);
  display.println(l6);
  display.display();
}

void showMessage(const char *status, const char *l5, const char *l6) {
  drawScreen(status, l5, l6);
  messageHoldUntilMs = millis() + MESSAGE_HOLD_MS;
}

// ---------------------------------------------------------------- logging
void logResult(Verdict v, const char *reason) {
  float tStart = isnan(startTempC) ? 0.0f : startTempC;
  float tMax = isnan(maxTempC) ? 0.0f : maxTempC;
  float meanA = sampleCount ? sumA / sampleCount : 0.0f;
  float irMilli = irValid ? irOhms * 1000.0f : 0.0f;
  float sag = (minV < 90.0f) ? (ocvV - minV) : 0.0f;
  float durS = (millis() - testStartedMs) / 1000.0f;

  Serial.printf(
      "RESULT {\"id\":%lu,\"result\":\"%s\",\"reason\":\"%s\",\"ocv_v\":%.3f,\"vmin_v\":%.3f,"
      "\"sag_v\":%.3f,\"peak_a\":%.3f,\"mean_a\":%.3f,\"ir_mohm\":%.1f,\"t_start_c\":%.1f,"
      "\"t_max_c\":%.1f,\"mah\":%.3f,\"duration_s\":%.1f}\n",
      (unsigned long)testId, VERDICT_NAMES[(uint8_t)v], reason, ocvV, minV, sag, peakA, meanA,
      irMilli, tStart, tMax, mAh, durS);

  if (!sdReady) return;
  bool fresh = !SD.exists(LOG_PATH);
  File f = SD.open(LOG_PATH, FILE_APPEND);
  if (!f) {
    sdReady = false;  // card removed or failed
    return;
  }
  if (fresh) {
    f.println(F("test_id,uptime_ms,ocv_v,vmin_v,sag_v,peak_a,mean_a,ir_mohm,"
                "t_start_c,t_max_c,mah,duration_s,result,reason"));
  }
  f.printf("%lu,%lu,%.3f,%.3f,%.3f,%.3f,%.3f,%.1f,%.1f,%.1f,%.3f,%.1f,%s,%s\n",
           (unsigned long)testId, (unsigned long)millis(), ocvV, minV, sag, peakA, meanA, irMilli,
           tStart, tMax, mAh, durS, VERDICT_NAMES[(uint8_t)v], reason);
  f.close();
}

// ------------------------------------------------- per-test sample logging
void closeSampleLog() {
  if (!sampleOpen) return;
  sampleFile.flush();
  sampleFile.close();
  sampleOpen = false;
}

bool openSampleLog() {
  if (!sdReady) return false;
  if (!SD.exists(TESTS_DIR)) SD.mkdir(TESTS_DIR);
  char path[32];
  snprintf(path, sizeof path, "%s/T%06lu.csv", TESTS_DIR, (unsigned long)testId);
  sampleFile = SD.open(path, FILE_WRITE);
  if (!sampleFile) {
    sdReady = false;
    return false;
  }
  sampleFile.println(F("elapsed_ms,node_v,cell_v,current_a,temp_c,sag_v,r_inst_mohm,mah,note"));
  sampleFile.flush();
  sampleOpen = true;
  lastFlushMs = millis();
  Serial.printf("sample log: %s\n", path);
  return true;
}

// Returns false if the card stopped accepting writes (logging is then closed).
bool writeSampleRow(uint32_t elapsed, float nodeV, float cellV, float amps, float tC, const char *note) {
  if (!sampleOpen) return true;
  float sag = ocvV - cellV;
  float rInst = (amps >= MIN_LOAD_CURRENT_A) ? fmaxf(0.0f, (ocvV - cellV) / amps) * 1000.0f : 0.0f;
  size_t n = sampleFile.printf("%lu,%.3f,%.3f,%.3f,%.1f,%.3f,%.1f,%.3f,%s\n", (unsigned long)elapsed,
                               nodeV, cellV, amps, tC, sag, rInst, mAh, note);
  if (n == 0) {
    sampleOpen = false;  // file is unusable; don't touch it again
    sdReady = false;
    Serial.println(F("SD write failed"));
    return false;
  }
  if (millis() - lastFlushMs >= FLUSH_PERIOD_MS) {
    sampleFile.flush();
    lastFlushMs = millis();
  }
  return true;
}

void writeSampleNote(uint32_t elapsed, const char *note) {  // event row, other columns empty
  if (!sampleOpen) return;
  sampleFile.printf("%lu,,,,,,,,%s\n", (unsigned long)elapsed, note);
}

// ------------------------------------------------------------- test logic
Verdict classify() {
  float sag = ocvV - minV;
  float rise = maxTempC - startTempC;

  if (cutoffHit) return (ocvV < LOW_SOC_VOLTAGE) ? Verdict::INSPECT : Verdict::RECYCLE;
  if (!irValid) return Verdict::INSPECT;
  if (irOhms > IR_RECYCLE_OHMS) return Verdict::RECYCLE;

  Verdict v = Verdict::REUSE;
  if (irOhms > IR_INSPECT_OHMS || sag > SAG_INSPECT_V || rise > TEMP_RISE_INSPECT_C)
    v = Verdict::INSPECT;
  if (v == Verdict::REUSE && ocvV < LOW_SOC_VOLTAGE) v = Verdict::INSPECT;  // low charge
  return v;
}

void finishTest(Verdict v, const char *reason) {
  endLoad();  // always first

  if (!irValid && peakA >= MIN_LOAD_CURRENT_A) {
    irOhms = fmaxf(0.0f, (ocvV - minV) / peakA);
    irValid = true;
  }

  state = (v == Verdict::FAULT) ? State::FAULT : State::DONE;
  setResultLeds(v == Verdict::REUSE, v == Verdict::INSPECT || v == Verdict::FAULT,
                v == Verdict::RECYCLE || v == Verdict::FAULT);

  switch (v) {
    case Verdict::REUSE:   startBeeps(1, 2400, 200, 100); break;
    case Verdict::INSPECT: startBeeps(2, 1800, 200, 150); break;
    case Verdict::RECYCLE: startBeeps(3, 1000, 250, 150); break;
    case Verdict::ABORTED: startBeeps(1, 800, 300, 0); break;
    case Verdict::FAULT:   startBeeps(4, 500, 150, 100); break;
  }

  char l5[24], l6[24];
  if (irValid) snprintf(l5, sizeof l5, "IR %.0fmOhm Sag %.2fV", irOhms * 1000.0f, ocvV - minV);
  else snprintf(l5, sizeof l5, "IR -- (no data)");
  if (v == Verdict::FAULT || v == Verdict::ABORTED) snprintf(l6, sizeof l6, "%s", reason);
  else if (ocvV < LOW_SOC_VOLTAGE && v == Verdict::INSPECT) snprintf(l6, sizeof l6, "Low charge: retest");
  else snprintf(l6, sizeof l6, "Vmin %.2f %.1fmAh", minV, mAh);

  drawScreen(VERDICT_NAMES[(uint8_t)v], l5, l6);

  char note[48];
  snprintf(note, sizeof note, "END %s: %s", VERDICT_NAMES[(uint8_t)v], reason);
  writeSampleNote(millis() - testStartedMs, note);
  closeSampleLog();
  logResult(v, reason);
}

void rejectStart(const char *status, const char *detail) {
  setResultLeds(false, false, false);
  showMessage(status, detail, "");
  startBeeps(1, 500, 350, 0);
}

void startTest() {
  if (!sensorsOk) { rejectStart("SENSOR FAULT", "ADS1115/INA219 missing"); return; }
  if (stopBtn.held()) { rejectStart("STOP BUTTON STUCK", "Release STOP"); return; }

  float nodeV = readNodeVoltage(8);
  float idleA = readCurrentA();
  float tC = readTemperatureC();
  lastVoltage = nodeV;
  lastCurrentA = idleA;
  lastTempC = tC;

  if (isnan(tC))                { rejectStart("CHECK NTC", "Thermistor open/short"); return; }
  if (!sensorsPresent())        { rejectStart("I2C SENSOR LOST", "Check wiring"); return; }
  if (lastAin0V > ADC_INPUT_MAX_V) { rejectStart("DIVIDER FAULT", "Check 20k/10k divider"); return; }
  if (idleA < REVERSE_CURRENT_A){ rejectStart("REVERSED CELL", "Flip the cell"); return; }
  if (idleA > IDLE_LEAK_A)      { rejectStart("LOAD STUCK ON", "Check MOSFET wiring"); return; }
  if (nodeV < MIN_START_VOLTAGE || nodeV > MAX_START_VOLTAGE) {
    rejectStart("CHECK CELL", "3.00-4.25V? E-STOP?");
    return;
  }
  if (tC > MAX_START_TEMP_C)    { rejectStart("COOL DOWN", "Cell above 40 C"); return; }

  if (REQUIRE_SD_FOR_TEST && !sdReady) {
    rejectStart("SD CARD ERROR", "Insert FAT32 card");
    return;
  }

  // Persistent test counter (only committed once the sample log exists)
  testId = prefs.getUInt("n", 0) + 1;
  if (sdReady && !openSampleLog() && REQUIRE_SD_FOR_TEST) {
    rejectStart("SD WRITE ERROR", "Cannot create log");
    return;
  }
  prefs.putUInt("n", testId);

  ocvV = nodeV;
  minV = nodeV;
  peakA = sumA = mAh = 0.0f;
  irOhms = 0.0f;
  irValid = cutoffHit = false;
  sampleCount = 0;
  startTempC = maxTempC = tC;

  setResultLeds(false, false, false);
  messageHoldUntilMs = 0;
  state = State::TESTING;
  testStartedMs = millis();
  lastSampleMs = testStartedMs;
  lastDisplayMs = 0;
  startBeeps(1, 2000, 80, 0);
  Serial.printf("START id=%lu ocv=%.3f t=%.1f\n", (unsigned long)testId, ocvV, startTempC);
  if (!writeSampleRow(0, nodeV, nodeV, 0.0f, tC, "START") && REQUIRE_SD_FOR_TEST) {
    closeSampleLog();
    state = State::IDLE;
    rejectStart("SD WRITE ERROR", "Log not writable");
    return;  // load was never switched on
  }
  digitalWrite(LOAD_GATE_PIN, HIGH);
}

void takeSample() {
  uint32_t now = millis();
  float dt = (now - lastSampleMs) / 1000.0f;
  lastSampleMs = now;
  uint32_t elapsed = now - testStartedMs;

  float nodeV = readNodeVoltage();
  float amps = readCurrentA();
  float tC = readTemperatureC();

  lastCurrentA = amps;
  lastTempC = tC;
  lastVoltage = cellVoltage(nodeV, amps);

  // ---- safety checks (load is switched off inside finishTest) ----
  if (!sensorsPresent())           { finishTest(Verdict::FAULT, "I2C sensor lost"); return; }
  if (lastAin0V > ADC_INPUT_MAX_V) { finishTest(Verdict::FAULT, "ADC overvoltage"); return; }
  if (amps < REVERSE_CURRENT_A)    { finishTest(Verdict::FAULT, "Reverse current"); return; }
  if (isnan(tC))            { finishTest(Verdict::FAULT, "NTC fault"); return; }
  if (tC >= MAX_CELL_TEMP_C){ finishTest(Verdict::RECYCLE, "Over temperature"); return; }
  if (amps > MAX_CURRENT_A) { finishTest(Verdict::FAULT, "Overcurrent"); return; }
  if (elapsed > LOAD_CHECK_MS && amps < MIN_LOAD_CURRENT_A) {
    finishTest(Verdict::FAULT, "No load current");  // e-stop, fuse, MOSFET or wiring
    return;
  }

  // ---- accumulate ----
  if (lastVoltage < minV) minV = lastVoltage;
  if (amps > peakA) peakA = amps;
  if (tC > maxTempC) maxTempC = tC;
  sumA += amps;
  sampleCount++;
  mAh += amps * dt * (1000.0f / 3600.0f);

  // Internal resistance from one simultaneous V/I pair, after the load settles.
  if (!irValid && elapsed >= IR_SETTLE_MS && amps >= MIN_LOAD_CURRENT_A) {
    irOhms = fmaxf(0.0f, (ocvV - lastVoltage) / amps);
    irValid = true;
  }

  Serial.printf("S,%lu,%.3f,%.3f,%.3f,%.1f\n", (unsigned long)elapsed, nodeV, lastVoltage, amps, tC);  // t_ms,node_v,cell_v,A,C

  if (!writeSampleRow(elapsed, nodeV, lastVoltage, amps, tC, "") && REQUIRE_SD_FOR_TEST) {
    finishTest(Verdict::FAULT, "SD write failed");
    return;
  }

  if (lastVoltage <= CUTOFF_VOLTAGE) {
    cutoffHit = true;
    finishTest(classify(), "Cutoff voltage hit");
    return;
  }

  if (now - lastDisplayMs >= DISPLAY_PERIOD_MS) {
    lastDisplayMs = now;
    char l5[24], l6[24];
    snprintf(l5, sizeof l5, "t %lus / %lus", (unsigned long)(elapsed / 1000),
             (unsigned long)(TEST_DURATION_MS / 1000));
    snprintf(l6, sizeof l6, "STOP aborts test");
    drawScreen("TESTING", l5, l6);
  }
}

void idleRefresh() {
  lastDisplayMs = millis();
  lastVoltage = readNodeVoltage();
  lastCurrentA = readCurrentA();
  lastTempC = readTemperatureC();

  // Idle-time alarms: the load is off, so anything flagged here is a wiring/hardware problem.
  const char *alarm = nullptr, *hint = "";
  if (!sensorsPresent())                     { alarm = "I2C SENSOR LOST"; hint = "Check wiring"; }
  else if (lastAin0V > ADC_INPUT_MAX_V)      { alarm = "DIVIDER FAULT";   hint = "Remove cell now"; }
  else if (lastCurrentA < REVERSE_CURRENT_A) { alarm = "REVERSED CELL";   hint = "Press E-STOP, flip"; }
  else if (lastCurrentA > IDLE_LEAK_A)       { alarm = "LOAD STUCK ON";   hint = "Press E-STOP"; }

  if (alarm) {
    if (alarm != idleAlarm) startBeeps(3, 500, 150, 100);  // beep once per new alarm
    idleAlarm = alarm;
    setResultLeds(false, true, true);
    drawScreen(alarm, hint, "");
    return;
  }
  if (idleAlarm) {
    idleAlarm = nullptr;
    setResultLeds(false, false, false);
  }
  drawScreen(sensorsOk ? "READY" : "SENSOR FAULT", "Press START", sdReady ? "SD: OK" : "SD: NOT FOUND");
}

// ---------------------------------------------------------------- watchdog
void watchdogBegin() {
  // If the loop ever stalls with the load on, reset. The 10 k gate pulldown
  // keeps the MOSFET off while the ESP32 reboots.
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  esp_task_wdt_config_t cfg = {.timeout_ms = 3000, .idle_core_mask = 0, .trigger_panic = true};
  esp_task_wdt_reconfigure(&cfg);
#else
  esp_task_wdt_init(3, true);
#endif
  esp_task_wdt_add(NULL);
}

// ------------------------------------------------------------------ setup
void setup() {
  pinMode(LOAD_GATE_PIN, OUTPUT);
  digitalWrite(LOAD_GATE_PIN, LOW);  // load OFF before anything else
  pinMode(REUSE_LED_PIN, OUTPUT);
  pinMode(INSPECT_LED_PIN, OUTPUT);
  pinMode(RECYCLE_LED_PIN, OUTPUT);
  setResultLeds(false, false, false);
  startBtn.begin();
  stopBtn.begin();
  buzzerBegin();

  Serial.begin(115200);
  Serial.println(F("\nPUNARVA 18650 screening firmware"));

  Wire.begin(21, 22);
  Wire.setTimeOut(50);  // a hung I2C device must not freeze the loop

  displayOk = display.begin(SSD1306_SWITCHCAPVCC, 0x3C, true, false);
  bool adsOk = ads.begin(0x48, &Wire);
  bool inaOk = ina219.begin(&Wire);
  sensorsOk = adsOk && inaOk;
  if (adsOk) {
    ads.setGain(GAIN_ONE);                  // +/-4.096 V; 4.2 V / 3 = 1.4 V
    ads.setDataRate(RATE_ADS1115_250SPS);
  }
  if (inaOk) ina219.setCalibration_32V_2A();
  Serial.printf("display=%d ads=%d ina219=%d\n", displayOk, adsOk, inaOk);

  SPI.begin(18, 19, 23, SD_CS_PIN);
  sdReady = SD.begin(SD_CS_PIN, SPI);
  if (sdReady && !SD.exists(TESTS_DIR)) SD.mkdir(TESTS_DIR);
  Serial.printf("sd=%d\n", sdReady);

  prefs.begin("punarva", false);

  if (sensorsOk) idleRefresh();
  else drawScreen("SENSOR FAULT", "Check I2C wiring", "");
  if (!sensorsOk) startBeeps(3, 500, 150, 100);

  watchdogBegin();
}

// ------------------------------------------------------------------- loop
void loop() {
  esp_task_wdt_reset();
  startBtn.update();
  stopBtn.update();
  buzzerUpdate();

  if (state == State::TESTING) {
    if (stopBtn.held()) {
      finishTest(Verdict::ABORTED, "User STOP");
      return;
    }
    if (millis() - lastSampleMs >= SAMPLE_PERIOD_MS) takeSample();
    // Hard stop on time, independent of sampling.
    if (state == State::TESTING && millis() - testStartedMs >= TEST_DURATION_MS) {
      finishTest(classify(), "Completed");
    }
    return;
  }

  // IDLE / DONE / FAULT: the load is off.
  if (startBtn.pressed) {
    startTest();
    return;
  }
  if (state == State::IDLE && millis() >= messageHoldUntilMs &&
      millis() - lastDisplayMs >= DISPLAY_PERIOD_MS && sensorsOk) {
    idleRefresh();
  }
}
