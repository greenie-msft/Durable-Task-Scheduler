import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsCollector } from '../src/metrics.js';
import type { RequestResult } from '../src/engine.js';

const makeResult = (
  latencyMs: number,
  statusCode: number | null,
  timestamp: number,
  error: string | null = null,
): RequestResult => ({ latencyMs, statusCode, timestamp, error });

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  describe('snapshot() with no data', () => {
    it('returns zero counts and zero latency', () => {
      const s = collector.snapshot();
      expect(s.total).toBe(0);
      expect(s.success).toBe(0);
      expect(s.fail).toBe(0);
      expect(s.rps).toBe(0);
      expect(s.latency.min).toBe(0);
      expect(s.latency.max).toBe(0);
      expect(s.latency.mean).toBe(0);
    });
  });

  describe('snapshot() counts', () => {
    it('counts total, success and fail correctly', () => {
      collector.record(makeResult(10, 200, 1000));
      collector.record(makeResult(20, 404, 1100));
      collector.record(makeResult(30, null, 1200, 'connection refused'));
      collector.record(makeResult(40, 201, 1300));

      const s = collector.snapshot();
      expect(s.total).toBe(4);
      expect(s.success).toBe(2); // 200 and 201
      expect(s.fail).toBe(2);   // 404 and error
    });

    it('treats 5xx as failures', () => {
      collector.record(makeResult(10, 500, 1000));
      collector.record(makeResult(10, 200, 1100));
      const s = collector.snapshot();
      expect(s.success).toBe(1);
      expect(s.fail).toBe(1);
    });
  });

  describe('snapshot() rps', () => {
    it('computes rps over elapsed time', () => {
      // 3 requests over 2 seconds → 1.5 rps
      collector.record(makeResult(5, 200, 0));
      collector.record(makeResult(5, 200, 1000));
      collector.record(makeResult(5, 200, 2000));
      const s = collector.snapshot();
      expect(s.rps).toBeCloseTo(1.5, 5);
    });

    it('returns total count as rps when all timestamps are equal', () => {
      collector.record(makeResult(5, 200, 1000));
      collector.record(makeResult(5, 200, 1000));
      const s = collector.snapshot();
      expect(s.rps).toBe(2);
    });
  });

  describe('snapshot() latency percentiles', () => {
    it('computes min, max and mean', () => {
      [10, 20, 30, 40, 50].forEach((l, i) =>
        collector.record(makeResult(l, 200, i * 100)),
      );
      const s = collector.snapshot();
      expect(s.latency.min).toBe(10);
      expect(s.latency.max).toBe(50);
      expect(s.latency.mean).toBe(30);
    });

    it('computes p50 on odd-length array', () => {
      [10, 20, 30, 40, 50].forEach((l, i) =>
        collector.record(makeResult(l, 200, i * 100)),
      );
      expect(collector.snapshot().latency.p50).toBe(30);
    });

    it('computes p90, p95, p99', () => {
      // 100 values: 1..100
      for (let i = 1; i <= 100; i++) {
        collector.record(makeResult(i, 200, i * 10));
      }
      const s = collector.snapshot();
      expect(s.latency.p90).toBe(90);
      expect(s.latency.p95).toBe(95);
      expect(s.latency.p99).toBe(99);
    });

    it('handles a single result correctly', () => {
      collector.record(makeResult(42, 200, 0));
      const s = collector.snapshot();
      expect(s.latency.min).toBe(42);
      expect(s.latency.max).toBe(42);
      expect(s.latency.mean).toBe(42);
      expect(s.latency.p50).toBe(42);
      expect(s.latency.p99).toBe(42);
    });
  });

  describe('timeSeries()', () => {
    it('returns empty array when no results', () => {
      expect(collector.timeSeries()).toEqual([]);
    });

    it('buckets by second', () => {
      collector.record(makeResult(10, 200, 0));       // second 0
      collector.record(makeResult(20, 200, 500));     // second 0
      collector.record(makeResult(30, 404, 1000));    // second 1
      collector.record(makeResult(40, 200, 1999));    // second 1
      collector.record(makeResult(50, 200, 2000));    // second 2

      const ts = collector.timeSeries();
      expect(ts).toHaveLength(3);

      expect(ts[0].second).toBe(0);
      expect(ts[0].requests).toBe(2);
      expect(ts[0].successes).toBe(2);
      expect(ts[0].failures).toBe(0);
      expect(ts[0].rps).toBe(2);
      expect(ts[0].meanLatencyMs).toBe(15);

      expect(ts[1].second).toBe(1);
      expect(ts[1].requests).toBe(2);
      expect(ts[1].successes).toBe(1);
      expect(ts[1].failures).toBe(1);
      expect(ts[1].rps).toBe(2);
      expect(ts[1].meanLatencyMs).toBe(35);

      expect(ts[2].second).toBe(2);
      expect(ts[2].requests).toBe(1);
    });

    it('returns points in ascending second order', () => {
      // Insert out of order
      collector.record(makeResult(10, 200, 3000));
      collector.record(makeResult(10, 200, 1000));
      collector.record(makeResult(10, 200, 2000));

      const ts = collector.timeSeries();
      expect(ts.map(p => p.second)).toEqual([1, 2, 3]);
    });

    it('counts errors as failures in time series', () => {
      collector.record(makeResult(10, null, 0, 'timeout'));
      const ts = collector.timeSeries();
      expect(ts[0].successes).toBe(0);
      expect(ts[0].failures).toBe(1);
    });
  });
});
