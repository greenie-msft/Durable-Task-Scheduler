import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runConstant } from '../src/scenarios/constant.js';
import { MetricsCollector } from '../src/metrics.js';
import type { RunConfig } from '../src/config.js';
import type { RequestEngine } from '../src/engine.js';
import type { RequestResult } from '../src/engine.js';

function makeConfig(overrides: Partial<RunConfig> = {}): RunConfig {
  return {
    url: 'http://localhost:9999/',
    method: 'GET',
    headers: {},
    body: undefined,
    vus: 2,
    duration: 200, // 200ms — fast for tests
    scenario: 'constant',
    output: 'terminal',
    timeout: 5000,
    ...overrides,
  };
}

function makeEngine(latencyMs = 10): RequestEngine {
  const result: RequestResult = {
    latencyMs,
    statusCode: 200,
    error: null,
    timestamp: Date.now(),
  };
  return {
    fire: vi.fn().mockResolvedValue(result),
    close: vi.fn().mockResolvedValue(undefined),
  } as unknown as RequestEngine;
}

describe('runConstant', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('returns a MetricsSummary after the duration elapses', async () => {
    const config = makeConfig({ vus: 2, duration: 100 });
    const engine = makeEngine();
    const collector = new MetricsCollector();

    const summary = await runConstant(config, engine, collector);

    expect(summary).toMatchObject({
      total: expect.any(Number),
      success: expect.any(Number),
      fail: expect.any(Number),
      rps: expect.any(Number),
    });
    expect(summary.total).toBeGreaterThan(0);
    expect(summary.success).toBe(summary.total);
    expect(summary.fail).toBe(0);
  });

  it('spawns exactly config.vus concurrent workers', async () => {
    // Use a slow engine so we can count concurrent in-flight calls
    let concurrent = 0;
    let maxConcurrent = 0;
    const vus = 5;

    const engine: RequestEngine = {
      fire: vi.fn(async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise(r => setTimeout(r, 20));
        concurrent--;
        return { latencyMs: 20, statusCode: 200, error: null, timestamp: Date.now() };
      }),
      close: vi.fn(),
    } as unknown as RequestEngine;

    const config = makeConfig({ vus, duration: 100 });
    const collector = new MetricsCollector();

    await runConstant(config, engine, collector);

    // At the first batch, all 5 VUs should fire simultaneously
    expect(maxConcurrent).toBe(vus);
  });

  it('calls onTick approximately once per second', async () => {
    vi.useFakeTimers();

    const config = makeConfig({ vus: 1, duration: 3000 });
    const engine: RequestEngine = {
      // Never resolves during fake timer run — we control time
      fire: vi.fn(() => new Promise<RequestResult>(resolve => {
        // resolve immediately so workers can loop
        resolve({ latencyMs: 1, statusCode: 200, error: null, timestamp: Date.now() });
      })),
      close: vi.fn(),
    } as unknown as RequestEngine;
    const collector = new MetricsCollector();
    const onTick = vi.fn();

    const promise = runConstant(config, engine, collector, onTick);

    // Advance 3 seconds — should trigger ticks at 1s, 2s, 3s
    await vi.advanceTimersByTimeAsync(3000);
    await promise;

    expect(onTick).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });

  it('onTick receives a MetricsSummary snapshot', async () => {
    const config = makeConfig({ vus: 1, duration: 1500 });
    const engine = makeEngine(5);
    const collector = new MetricsCollector();
    const snapshots: ReturnType<MetricsCollector['snapshot']>[] = [];

    await runConstant(config, engine, collector, snap => snapshots.push(snap));

    expect(snapshots.length).toBeGreaterThanOrEqual(1);
    for (const snap of snapshots) {
      expect(snap).toHaveProperty('total');
      expect(snap).toHaveProperty('latency');
    }
  });

  it('works without an onTick callback', async () => {
    const config = makeConfig({ vus: 1, duration: 100 });
    const engine = makeEngine();
    const collector = new MetricsCollector();

    await expect(runConstant(config, engine, collector)).resolves.toBeDefined();
  });

  it('records all results into the collector', async () => {
    const config = makeConfig({ vus: 3, duration: 150 });
    const engine = makeEngine();
    const collector = new MetricsCollector();

    const summary = await runConstant(config, engine, collector);
    const collectorSummary = collector.snapshot();

    expect(summary.total).toBe(collectorSummary.total);
    expect(summary.total).toBeGreaterThan(0);
  });

  it('counts failed requests correctly', async () => {
    const engine: RequestEngine = {
      fire: vi.fn(async () => ({
        latencyMs: 5,
        statusCode: 500,
        error: null,
        timestamp: Date.now(),
      })),
      close: vi.fn(),
    } as unknown as RequestEngine;

    const config = makeConfig({ vus: 1, duration: 100 });
    const collector = new MetricsCollector();
    const summary = await runConstant(config, engine, collector);

    expect(summary.fail).toBe(summary.total);
    expect(summary.success).toBe(0);
  });
});
