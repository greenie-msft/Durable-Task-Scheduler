import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runConstant } from '../src/scenarios/constant.js';
import { runRampup } from '../src/scenarios/rampup.js';
import { runSpike } from '../src/scenarios/spike.js';
import { runScenario } from '../src/scenarios/index.js';
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
  // Use a 1 ms real delay so the workers don't spin millions of times in a
  // 100–200 ms test window, which would fill the vitest worker-thread heap.
  return {
    fire: async () => {
      await new Promise<void>(r => setTimeout(r, 1));
      return {
        latencyMs,
        statusCode: 200 as number | null,
        error: null as string | null,
        timestamp: Date.now(),
      };
    },
    close: async () => undefined,
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

    // Advance 3 seconds synchronously so the setInterval ticks fire without
    // deadlocking on the microtask queue (advanceTimersByTimeAsync uses
    // originalSetTimeout internally, which cannot fire while the worker's
    // microtask loop is active).
    vi.advanceTimersByTime(3000);
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
      fire: vi.fn(async () => {
        // Real 1 ms delay prevents a tight microtask loop that would fill the
        // heap before the 100 ms deadline elapses.
        await new Promise<void>(r => setTimeout(r, 1));
        return { latencyMs: 5, statusCode: 500, error: null, timestamp: Date.now() };
      }),
      close: vi.fn(),
    } as unknown as RequestEngine;

    const config = makeConfig({ vus: 1, duration: 100 });
    const collector = new MetricsCollector();
    const summary = await runConstant(config, engine, collector);

    expect(summary.fail).toBe(summary.total);
    expect(summary.success).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// runRampup
// ---------------------------------------------------------------------------

describe('runRampup', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('returns a MetricsSummary after the duration elapses', async () => {
    const config = makeConfig({
      scenario: 'rampup',
      duration: 300,
      rampDuration: 200,
      maxVus: 3,
    });
    const engine = makeEngine(5);
    const collector = new MetricsCollector();

    const summary = await runRampup(config, engine, collector);

    expect(summary).toMatchObject({
      total: expect.any(Number),
      success: expect.any(Number),
      fail: expect.any(Number),
      rps: expect.any(Number),
    });
    expect(summary.total).toBeGreaterThan(0);
    expect(summary.success).toBe(summary.total);
  });

  it('spawns workers up to maxVus by the end of rampDuration', async () => {
    let maxConcurrent = 0;
    let concurrent = 0;

    const engine: RequestEngine = {
      fire: vi.fn(async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise(r => setTimeout(r, 5));
        concurrent--;
        return { latencyMs: 5, statusCode: 200, error: null, timestamp: Date.now() };
      }),
      close: vi.fn(),
    } as unknown as RequestEngine;

    const config = makeConfig({
      scenario: 'rampup',
      duration: 400,
      rampDuration: 200,
      maxVus: 4,
    });
    const collector = new MetricsCollector();

    await runRampup(config, engine, collector);

    // By the hold phase all 4 VUs should have been active simultaneously at some point.
    expect(maxConcurrent).toBe(4);
  });

  it('calls onTick approximately once per second', async () => {
    vi.useFakeTimers();

    const config = makeConfig({
      scenario: 'rampup',
      duration: 3000,
      rampDuration: 1500,
      maxVus: 3,
    });
    const engine: RequestEngine = {
      fire: vi.fn(() =>
        Promise.resolve({ latencyMs: 1, statusCode: 200, error: null, timestamp: Date.now() }),
      ),
      close: vi.fn(),
    } as unknown as RequestEngine;
    const collector = new MetricsCollector();
    const onTick = vi.fn();

    const promise = runRampup(config, engine, collector, onTick);
    // Synchronous advance avoids the advanceTimersByTimeAsync deadlock caused
    // by workers spinning in the microtask queue.
    vi.advanceTimersByTime(3000);
    await promise;

    expect(onTick).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });

  it('works without an onTick callback', async () => {
    const config = makeConfig({
      scenario: 'rampup',
      duration: 150,
      rampDuration: 100,
      maxVus: 2,
    });
    const engine = makeEngine();
    const collector = new MetricsCollector();

    await expect(runRampup(config, engine, collector)).resolves.toBeDefined();
  });

  it('falls back to config.vus when maxVus is not set', async () => {
    const config = makeConfig({
      scenario: 'rampup',
      duration: 200,
      rampDuration: 100,
      vus: 2,
      maxVus: undefined,
    });
    const engine = makeEngine();
    const collector = new MetricsCollector();

    const summary = await runRampup(config, engine, collector);
    expect(summary.total).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// runSpike
// ---------------------------------------------------------------------------

describe('runSpike', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('returns a MetricsSummary after the duration elapses', async () => {
    const config = makeConfig({
      scenario: 'spike',
      vus: 2,
      duration: 400,
      maxVus: 5,
      spikeDuration: 100,
    });
    const engine = makeEngine(5);
    const collector = new MetricsCollector();

    const summary = await runSpike(config, engine, collector);

    expect(summary).toMatchObject({
      total: expect.any(Number),
      success: expect.any(Number),
      fail: expect.any(Number),
    });
    expect(summary.total).toBeGreaterThan(0);
    expect(summary.success).toBe(summary.total);
  });

  it('spawns a spike of workers at the midpoint', async () => {
    let maxConcurrent = 0;
    let concurrent = 0;

    const engine: RequestEngine = {
      fire: vi.fn(async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise(r => setTimeout(r, 5));
        concurrent--;
        return { latencyMs: 5, statusCode: 200, error: null, timestamp: Date.now() };
      }),
      close: vi.fn(),
    } as unknown as RequestEngine;

    const config = makeConfig({
      scenario: 'spike',
      vus: 1,
      duration: 500,
      maxVus: 4,
      spikeDuration: 200,
    });
    const collector = new MetricsCollector();

    await runSpike(config, engine, collector);

    // baseline (1) + spike (4) = 5 concurrent at peak
    expect(maxConcurrent).toBeGreaterThanOrEqual(4);
  });

  it('spike workers stop after spikeDuration', async () => {
    // Track concurrent count over time; it should drop back after the spike window.
    const concurrencyTimeline: Array<{ ts: number; concurrent: number }> = [];
    let concurrent = 0;

    const engine: RequestEngine = {
      fire: vi.fn(async () => {
        concurrent++;
        concurrencyTimeline.push({ ts: Date.now(), concurrent });
        await new Promise(r => setTimeout(r, 5));
        concurrent--;
        return { latencyMs: 5, statusCode: 200, error: null, timestamp: Date.now() };
      }),
      close: vi.fn(),
    } as unknown as RequestEngine;

    const vus = 1;
    const maxVus = 4;
    const duration = 600;
    const spikeDuration = 100;

    const config = makeConfig({ scenario: 'spike', vus, duration, maxVus, spikeDuration });
    const collector = new MetricsCollector();

    const startTime = Date.now();
    await runSpike(config, engine, collector);
    const endTime = Date.now();

    // Find if there was ever a point where concurrency exceeded the baseline after spike ended
    const spikeEndApprox = startTime + duration / 2 + spikeDuration + 100; // +100ms slack
    const postSpike = concurrencyTimeline.filter(p => p.ts > spikeEndApprox && p.ts < endTime - 50);

    // After the spike window, concurrency should be at most vus (baseline)
    for (const point of postSpike) {
      expect(point.concurrent).toBeLessThanOrEqual(vus + 1); // +1 for timing jitter
    }
  });

  it('calls onTick approximately once per second', async () => {
    vi.useFakeTimers();

    const config = makeConfig({
      scenario: 'spike',
      vus: 1,
      duration: 3000,
      maxVus: 3,
      spikeDuration: 500,
    });
    const engine: RequestEngine = {
      fire: vi.fn(() =>
        Promise.resolve({ latencyMs: 1, statusCode: 200, error: null, timestamp: Date.now() }),
      ),
      close: vi.fn(),
    } as unknown as RequestEngine;
    const collector = new MetricsCollector();
    const onTick = vi.fn();

    const promise = runSpike(config, engine, collector, onTick);
    // Synchronous advance avoids the advanceTimersByTimeAsync deadlock caused
    // by workers spinning in the microtask queue.
    vi.advanceTimersByTime(3000);
    await promise;

    expect(onTick).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });

  it('works without an onTick callback', async () => {
    const config = makeConfig({
      scenario: 'spike',
      vus: 1,
      duration: 200,
      maxVus: 3,
      spikeDuration: 50,
    });
    const engine = makeEngine();
    const collector = new MetricsCollector();

    await expect(runSpike(config, engine, collector)).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// runScenario dispatcher
// ---------------------------------------------------------------------------

describe('runScenario', () => {
  it('dispatches constant scenario', async () => {
    const config = makeConfig({ scenario: 'constant', vus: 1, duration: 100 });
    const engine = makeEngine();
    const collector = new MetricsCollector();

    const summary = await runScenario(config, engine, collector);
    expect(summary.total).toBeGreaterThan(0);
  });

  it('dispatches rampup scenario', async () => {
    const config = makeConfig({
      scenario: 'rampup',
      duration: 200,
      rampDuration: 100,
      maxVus: 2,
    });
    const engine = makeEngine();
    const collector = new MetricsCollector();

    const summary = await runScenario(config, engine, collector);
    expect(summary.total).toBeGreaterThan(0);
  });

  it('dispatches spike scenario', async () => {
    const config = makeConfig({
      scenario: 'spike',
      vus: 1,
      duration: 300,
      maxVus: 3,
      spikeDuration: 80,
    });
    const engine = makeEngine();
    const collector = new MetricsCollector();

    const summary = await runScenario(config, engine, collector);
    expect(summary.total).toBeGreaterThan(0);
  });

  it('forwards onTick to the underlying runner', async () => {
    const config = makeConfig({ scenario: 'constant', vus: 1, duration: 1500 });
    const engine = makeEngine(5);
    const collector = new MetricsCollector();
    const onTick = vi.fn();

    await runScenario(config, engine, collector, onTick);

    expect(onTick).toHaveBeenCalled();
  });
});
