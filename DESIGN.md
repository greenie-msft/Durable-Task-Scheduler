# Load Testing CLI — Design Document

## Overview

A **load testing CLI** (`loadtest`) built with **TypeScript/Node.js** that allows developers to stress-test HTTP endpoints (including Durable Task Scheduler orchestration endpoints). It measures throughput, latency distributions, and error rates under configurable load profiles.

---

## Goals

- Fire HTTP requests at a target URL with configurable concurrency and duration
- Collect and aggregate metrics: RPS, latency (p50/p95/p99/max), error counts
- Support multiple load scenarios: constant load, ramp-up, and spike
- Render a live progress bar and a final summary table in the terminal
- Export results as JSON or CSV for CI/CD integration
- Zero runtime dependencies beyond the Node.js standard library + a small set of well-known npm packages

---

## Architecture

```
loadtest/
├── package.json          # npm project + bin entry
├── tsconfig.json         # TypeScript config
├── src/
│   ├── cli.ts            # Commander-based CLI entry point
│   ├── config.ts         # Zod-validated config types & defaults
│   ├── engine.ts         # HTTP request engine (fetch/undici) with timing
│   ├── metrics.ts        # Real-time metric collection & HDR-style histograms
│   ├── reporter.ts       # Terminal table, progress bar, JSON/CSV export
│   ├── scenarios/
│   │   ├── constant.ts   # Fixed concurrency for N seconds
│   │   ├── rampup.ts     # Linear ramp from 0 → maxVUs over ramp period
│   │   └── spike.ts      # Sudden spike then drop-back baseline
│   └── index.ts          # Public API re-exports
├── tests/
│   ├── metrics.test.ts
│   ├── engine.test.ts
│   └── scenarios.test.ts
└── README.md
```

---

## Key Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| Language | TypeScript | Strong typing, rich CLI ecosystem, matches repo style |
| HTTP client | `undici` | High-perf Node.js HTTP, used by Node core |
| CLI framework | `commander` | Minimal, well-maintained |
| Terminal output | `cli-table3` + `ora` | Tables & spinners with no heavy deps |
| Validation | `zod` | Schema-first config validation with clear errors |
| Test runner | `vitest` | Fast, TypeScript-native |

---

## CLI Usage

```bash
# Basic load test
loadtest run --url https://api.example.com/start --vus 50 --duration 30s

# Ramp-up scenario
loadtest run --url https://api.example.com/start --scenario rampup \
  --ramp-duration 10s --max-vus 100 --duration 60s

# POST with body
loadtest run --url https://api.example.com/orchestrate \
  --method POST --body '{"input":"hello"}' --header "Authorization: Bearer $TOKEN"

# Export JSON results
loadtest run --url https://api.example.com --output json > results.json
```

---

## Metrics Collected

- **Requests**: total, successful, failed
- **Throughput**: current RPS, average RPS
- **Latency**: min, mean, p50, p90, p95, p99, max
- **Errors**: status code breakdown, connection errors

---

## Load Scenarios

| Scenario | Description |
|---|---|
| `constant` | N virtual users fire requests continuously for the full duration |
| `rampup` | VUs linearly increase from 0 → max over the ramp period, then hold |
| `spike` | Hold baseline, spike to max for a short window, return to baseline |

---

## Output Formats

- **Terminal** (default): live spinner + final summary table with color coding
- **JSON** (`--output json`): full metrics object, suitable for CI assertions
- **CSV** (`--output csv`): time-series data per second for plotting
