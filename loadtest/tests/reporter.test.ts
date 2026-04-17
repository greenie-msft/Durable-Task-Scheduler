import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportJson, exportCsv, outputResults, LiveReporter } from '../src/reporter.js';
import type { MetricsSummary, TimeSeriesPoint } from '../src/metrics.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeSummary = (overrides: Partial<MetricsSummary> = {}): MetricsSummary => ({
  total: 100,
  success: 95,
  fail: 5,
  rps: 10,
  latency: {
    min: 5,
    mean: 20,
    p50: 18,
    p90: 35,
    p95: 45,
    p99: 80,
    max: 200,
  },
  ...overrides,
});

const makePoint = (
  second: number,
  rps: number,
  meanLatencyMs: number,
  failures: number,
): TimeSeriesPoint => ({
  second,
  requests: rps,
  successes: rps - failures,
  failures,
  rps,
  meanLatencyMs,
});

// ---------------------------------------------------------------------------
// exportJson
// ---------------------------------------------------------------------------

describe('exportJson', () => {
  it('returns a valid JSON string', () => {
    const json = exportJson(makeSummary());
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('round-trips the summary object', () => {
    const summary = makeSummary();
    const parsed = JSON.parse(exportJson(summary));
    expect(parsed.total).toBe(summary.total);
    expect(parsed.success).toBe(summary.success);
    expect(parsed.fail).toBe(summary.fail);
    expect(parsed.rps).toBe(summary.rps);
    expect(parsed.latency.p99).toBe(summary.latency.p99);
  });

  it('is pretty-printed (contains newlines)', () => {
    const json = exportJson(makeSummary());
    expect(json).toContain('\n');
  });

  it('handles zero-value summary', () => {
    const summary = makeSummary({ total: 0, success: 0, fail: 0, rps: 0 });
    const parsed = JSON.parse(exportJson(summary));
    expect(parsed.total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// exportCsv
// ---------------------------------------------------------------------------

describe('exportCsv', () => {
  it('produces correct header row', () => {
    const csv = exportCsv([]);
    const firstLine = csv.split('\n')[0];
    expect(firstLine).toBe('timestamp,rps,p50,p99,errors');
  });

  it('returns only the header when points array is empty', () => {
    const csv = exportCsv([]);
    expect(csv.split('\n')).toHaveLength(1);
  });

  it('generates one data row per time-series point', () => {
    const points = [
      makePoint(1000, 5, 12.5, 0),
      makePoint(1001, 8, 20.0, 1),
    ];
    const lines = exportCsv(points).split('\n');
    expect(lines).toHaveLength(3); // header + 2 data rows
  });

  it('encodes timestamp, rps, and errors correctly', () => {
    const points = [makePoint(1234, 7, 15.0, 2)];
    const lines = exportCsv(points).split('\n');
    const cols = lines[1].split(',');
    expect(cols[0]).toBe('1234');   // timestamp (second)
    expect(cols[1]).toBe('7');      // rps
    expect(cols[4]).toBe('2');      // errors
  });

  it('uses meanLatencyMs for p50 column', () => {
    const points = [makePoint(1000, 10, 42.75, 0)];
    const lines = exportCsv(points).split('\n');
    const cols = lines[1].split(',');
    expect(cols[2]).toBe('42.75');  // p50 = meanLatencyMs
  });

  it('emits 0 for p99 column (not tracked per bucket)', () => {
    const points = [makePoint(1000, 10, 42, 0)];
    const cols = exportCsv(points).split('\n')[1].split(',');
    expect(cols[3]).toBe('0');
  });
});

// ---------------------------------------------------------------------------
// outputResults
// ---------------------------------------------------------------------------

describe('outputResults', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  it('writes JSON when config.output === "json"', () => {
    outputResults({ output: 'json' }, makeSummary());
    expect(writeSpy).toHaveBeenCalledOnce();
    const written = String(writeSpy.mock.calls[0][0]);
    const parsed = JSON.parse(written.trim());
    expect(parsed.total).toBe(100);
  });

  it('writes CSV when config.output === "csv"', () => {
    const points = [makePoint(1, 5, 10, 0)];
    outputResults({ output: 'csv' }, makeSummary(), points);
    expect(writeSpy).toHaveBeenCalledOnce();
    const written = String(writeSpy.mock.calls[0][0]);
    expect(written).toContain('timestamp,rps,p50,p99,errors');
  });

  it('prints table to stdout when config.output === "terminal"', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    outputResults({ output: 'terminal' }, makeSummary());
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('defaults to terminal output when output is "terminal"', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    outputResults({ output: 'terminal' }, makeSummary());
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// LiveReporter — smoke tests
// ---------------------------------------------------------------------------

describe('LiveReporter', () => {
  it('can be instantiated without errors', () => {
    const reporter = new LiveReporter();
    expect(reporter).toBeDefined();
  });

  it('start, tick and stop do not throw', () => {
    const reporter = new LiveReporter();
    expect(() => {
      reporter.start();
      reporter.tick(50, 10);
      reporter.stop();
    }).not.toThrow();
  });

  it('succeed does not throw', () => {
    const reporter = new LiveReporter();
    reporter.start();
    expect(() => reporter.succeed('Test complete')).not.toThrow();
  });
});
