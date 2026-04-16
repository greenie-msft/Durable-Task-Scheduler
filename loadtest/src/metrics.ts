import type { RequestResult } from './engine.js';

export interface MetricsSummary {
  total: number;
  success: number;
  fail: number;
  /** Average requests per second over the full test window. */
  rps: number;
  latency: {
    min: number;
    mean: number;
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    max: number;
  };
}

export interface TimeSeriesPoint {
  /** Unix epoch second (Math.floor(timestamp / 1000)). */
  second: number;
  requests: number;
  successes: number;
  failures: number;
  /** Requests in this second (same as requests for a 1-second bucket). */
  rps: number;
  meanLatencyMs: number;
}

export class MetricsCollector {
  private results: RequestResult[] = [];

  record(result: RequestResult): void {
    this.results.push(result);
  }

  snapshot(): MetricsSummary {
    const { results } = this;
    const total = results.length;

    if (total === 0) {
      return {
        total: 0,
        success: 0,
        fail: 0,
        rps: 0,
        latency: { min: 0, mean: 0, p50: 0, p90: 0, p95: 0, p99: 0, max: 0 },
      };
    }

    let success = 0;
    for (const r of results) {
      if (r.error === null && r.statusCode !== null && r.statusCode < 400) {
        success++;
      }
    }
    const fail = total - success;

    // Sorted latency array for percentile calculations.
    const latencies = results.map(r => r.latencyMs).sort((a, b) => a - b);
    const min = latencies[0];
    const max = latencies[latencies.length - 1];
    const mean = latencies.reduce((sum, v) => sum + v, 0) / latencies.length;

    const percentile = (p: number): number => {
      const idx = Math.ceil((p / 100) * latencies.length) - 1;
      return latencies[Math.max(0, idx)];
    };

    // RPS = total requests / elapsed seconds (first to last timestamp).
    const timestamps = results.map(r => r.timestamp);
    const minTs = Math.min(...timestamps);
    const maxTs = Math.max(...timestamps);
    const elapsedSec = (maxTs - minTs) / 1000;
    const rps = elapsedSec > 0 ? total / elapsedSec : total;

    return {
      total,
      success,
      fail,
      rps,
      latency: {
        min,
        mean,
        p50: percentile(50),
        p90: percentile(90),
        p95: percentile(95),
        p99: percentile(99),
        max,
      },
    };
  }

  timeSeries(): TimeSeriesPoint[] {
    if (this.results.length === 0) return [];

    const buckets = new Map<number, RequestResult[]>();
    for (const r of this.results) {
      const sec = Math.floor(r.timestamp / 1000);
      let bucket = buckets.get(sec);
      if (!bucket) {
        bucket = [];
        buckets.set(sec, bucket);
      }
      bucket.push(r);
    }

    const seconds = [...buckets.keys()].sort((a, b) => a - b);
    return seconds.map(sec => {
      const bucket = buckets.get(sec)!;
      const requests = bucket.length;
      const successes = bucket.filter(
        r => r.error === null && r.statusCode !== null && r.statusCode < 400,
      ).length;
      const failures = requests - successes;
      const meanLatencyMs = bucket.reduce((sum, r) => sum + r.latencyMs, 0) / requests;

      return {
        second: sec,
        requests,
        successes,
        failures,
        rps: requests,
        meanLatencyMs,
      };
    });
  }
}
