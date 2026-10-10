# PUNARVA — CSV Formats

PUNARVA exports contain **the actual samples used for a report** — no
smoothing, no interpolation, no gap-filling. Empty cells mean *no valid
measurement at that tick*.

---

## 1. Samples CSV (one test)

Produced by **Export CSV** on any test report. Filename: `<TEST_ID>-samples.csv`.

```csv
test_id,t_offset_ms,voltage_v,current_a,temperature_c
PVR-20261010-222339-BD6E,0,4.0502,0.4512,28.01
PVR-20261010-222339-BD6E,250,4.0495,0.4498,28.03
PVR-20261010-222339-BD6E,500,,,,,        ← example of a dropped tick (empty cells)
PVR-20261010-222339-BD6E,750,4.0471,0.4503,28.04
```

| Column | Meaning |
| --- | --- |
| `test_id` | PUNARVA test identifier (`PVR-YYYYMMDD-HHMMSS-XXXX`) |
| `t_offset_ms` | Milliseconds since test start (integer, monotonic) |
| `voltage_v` | Voltage sample in volts, or empty |
| `current_a` | Current sample in amperes, or empty |
| `temperature_c` | Temperature sample in °C, or empty |

Test metadata (battery ID, chemistry, duration, source, statistics,
completeness) is displayed on the report itself and included in the summary
export — the samples file stays pure data.

---

## 2. History summary CSV (all tests)

Produced by **Test History → Export summary CSV**. One row per record.

```csv
test_id,started_at,ended_at,status,data_source,battery_id,chemistry,
nominal_voltage_v,rated_capacity_ah,configured_duration_s,effective_duration_s,
sample_interval_ms,sample_count,expected_samples,completeness_pct,
voltage_min_v,voltage_max_v,voltage_avg_v,
current_min_a,current_max_a,current_avg_a,
temp_min_c,temp_max_c,temp_avg_c
```

- `data_source` is `DEMO`, `HARDWARE`, or `IMPORTED` — always trust this column
  when interpreting a shared file.
- Empty statistic cells mean fewer than one valid sample on that channel.
- `completeness_pct` = valid samples ÷ expected samples × 100.

---

## 3. Import rules (strict)

**Test History → Import CSV** accepts *samples* files. Validation is
deliberately strict — an invalid file produces an error, never a guessed
record:

1. The header must contain `t_offset_ms`, `voltage_v`, `current_a`,
   `temperature_c` (aliases accepted: `t_ms`, `time_ms`, `voltage`, `current`,
   `temperature`, `temp_c`, …).
2. Every `t_offset_ms` must be a non-negative finite number; a bad value aborts
   the import with the row number.
3. Channel cells may be empty (→ missing sample) but if present must parse as
   finite numbers; bad numbers abort with the row number.
4. Mixed `test_id` values across rows produce a warning; the first value wins.
5. If no ID is present, a fresh `PVR-…` ID is generated.
6. On success the record is added with source **`IMPORTED`** and a stats/
   completeness recomputation; channel-less files gain a warning.

Typical use: transferring MicroSD logs from the ESP32. Device records appear in
the dashboard **only** through this explicit import — nothing syncs
automatically.
