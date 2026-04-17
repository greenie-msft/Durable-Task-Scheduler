# loadtest

A lightweight load-testing CLI for HTTP endpoints. It fires configurable concurrent requests, collects real-time metrics (RPS, latency percentiles, error rates), and renders results in the terminal or exports them as JSON/CSV.

---

## Installation

**Global install (requires Node.js ≥ 18):**

```bash
npm install -g loadtest
loadtest --help
```

**Run without installing:**

```bash
npx loadtest run --url https://api.example.com --vus 10 --duration 30s
```

**From source:**

```bash
cd loadtest
npm install
npm run build
node dist/cli.js run --url https://api.example.com --vus 10 --duration 30s
```

---

## CLI Reference

### `loadtest run`

Run a load test against a target URL.

```
loadtest run --url <url> [options]
```

| Flag | Description | Default |
|------|-------------|---------|
| `--url <url>` | **(Required)** Target URL to load test | — |
| `--method <method>` | HTTP method: `GET`, `POST`, `PUT`, `DELETE`, `PATCH` | `GET` |
| `--vus <number>` | Number of virtual users (concurrent workers) | `10` |
| `--duration <duration>` | Test duration, e.g. `30s`, `1m`, `2m30s` | — |
| `--scenario <scenario>` | Load scenario: `constant`, `rampup`, `spike` | `constant` |
| `--ramp-duration <duration>` | Duration of the ramp-up phase for `rampup` scenario | — |
| `--max-vus <number>` | Maximum VUs reached at the end of ramp / spike peak | — |
| `--spike-duration <duration>` | Duration of the spike window for `spike` scenario | — |
| `--header <header>` | HTTP header in `"Name: Value"` format (repeatable) | — |
| `--body <body>` | Request body string | — |
| `--output <format>` | Output format: `terminal`, `json`, `csv` | `terminal` |
| `--timeout <duration>` | Per-request timeout | `30s` |

**Duration format:** combine units freely — `h` (hours), `m` (minutes), `s` (seconds), `ms` (milliseconds). Examples: `30s`, `1m`, `1m30s`, `500ms`.

---

## Load Scenarios

| Scenario | Description |
|----------|-------------|
| `constant` | Fixed number of VUs (`--vus`) fire requests continuously for the full duration |
| `rampup` | VUs increase linearly from 0 → `--max-vus` over `--ramp-duration`, then hold for the rest of `--duration` |
| `spike` | Hold at `--vus` baseline, spike to `--max-vus` for `--spike-duration`, then return to baseline |

---

## Example Commands

**Basic GET test — 50 VUs for 30 seconds:**

```bash
loadtest run --url https://api.example.com/health --vus 50 --duration 30s
```

**POST with JSON body and Authorization header:**

```bash
loadtest run \
  --url https://api.example.com/orchestrate \
  --method POST \
  --body '{"input":"hello"}' \
  --header "Authorization: Bearer $TOKEN" \
  --header "Content-Type: application/json" \
  --vus 20 \
  --duration 1m
```

**Ramp-up scenario — grow from 0 to 100 VUs over 10 s, then sustain for 60 s total:**

```bash
loadtest run \
  --url https://api.example.com/start \
  --scenario rampup \
  --ramp-duration 10s \
  --max-vus 100 \
  --duration 60s
```

**Export results as JSON (pipe to file for CI assertions):**

```bash
loadtest run --url https://api.example.com --vus 20 --duration 30s --output json > results.json
```

**Export time-series as CSV (for plotting):**

```bash
loadtest run --url https://api.example.com --vus 20 --duration 30s --output csv > results.csv
```

---

## Sample Terminal Output

While the test runs, a live spinner shows elapsed time, current RPS, and active VUs:

```
⠸ Elapsed: 12.3s  RPS: 842.1  VUs: 50
```

After the test completes, a summary table is printed:

```
✔ Load test complete
┌─────────────────┬────────────────┐
│ Metric          │ Value          │
├─────────────────┼────────────────┤
│ Total Requests  │ 25340          │
│ Successes       │ 25310          │
│ Failures        │ 30             │
│ RPS (avg)       │ 844.67         │
│ Latency min     │ 2.10 ms        │
│ Latency mean    │ 58.34 ms       │
│ Latency p50     │ 52.00 ms       │
│ Latency p90     │ 98.00 ms       │
│ Latency p95     │ 121.00 ms      │
│ Latency p99     │ 210.00 ms      │
│ Latency max     │ 1842.00 ms     │
└─────────────────┴────────────────┘
```

---

## Output Format Details

### `terminal` (default)

Prints a live spinner during the run and a color-coded summary table on completion. Colors indicate health:
- **Green** — healthy (low error rate, good throughput)
- **Yellow** — warning (some errors or low RPS)
- **Red** — critical (high error rate or p99 latency > 1 s)

### `json`

Writes a single JSON object to stdout containing the full metrics summary. Useful for CI pipelines.

```json
{
  "total": 25340,
  "success": 25310,
  "fail": 30,
  "rps": 844.67,
  "latency": {
    "min": 2.10,
    "mean": 58.34,
    "p50": 52.00,
    "p90": 98.00,
    "p95": 121.00,
    "p99": 210.00,
    "max": 1842.00
  },
  "statusCodes": { "200": 25310, "503": 30 }
}
```

### `csv`

Writes a CSV time-series (one row per second) to stdout, suitable for plotting in Excel, Grafana, or similar tools.

```
timestamp,rps,p50,p95,p99,errors
0,0.00,0.00,0.00,0.00,0
1,712.00,48.00,110.00,198.00,0
2,851.00,51.00,115.00,205.00,1
...
```

---

## Contributing

1. Fork the repo and create a feature branch.
2. Install dependencies: `npm install`
3. Make your changes under `src/`.
4. Run tests: `npm test`
5. Build to verify TypeScript compiles: `npm run build`
6. Open a pull request describing your changes.

Please keep runtime dependencies minimal — the project intentionally avoids heavy frameworks. New scenarios belong in `src/scenarios/`, new metrics logic in `src/metrics.ts`.
