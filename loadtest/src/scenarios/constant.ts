import type { RunConfig } from '../config.js';
import type { RequestEngine } from '../engine.js';
import type { MetricsCollector, MetricsSummary } from '../metrics.js';

/**
 * Runs a constant-load scenario: spawns exactly `config.vus` concurrent workers,
 * each looping engine.fire() → collector.record() until the configured duration elapses.
 * Calls `onTick` once per second with a live snapshot.
 * Returns the final summary when all workers have stopped.
 */
export async function runConstant(
  config: RunConfig,
  engine: RequestEngine,
  collector: MetricsCollector,
  onTick?: (summary: MetricsSummary) => void,
): Promise<MetricsSummary> {
  const deadline = Date.now() + config.duration;
  let tickInterval: ReturnType<typeof setInterval> | undefined;

  if (onTick) {
    tickInterval = setInterval(() => {
      onTick(collector.snapshot());
    }, 1000);
  }

  async function workerLoop(): Promise<void> {
    while (Date.now() < deadline) {
      const result = await engine.fire(config);
      collector.record(result);
    }
  }

  const workers: Promise<void>[] = [];
  for (let i = 0; i < config.vus; i++) {
    workers.push(workerLoop());
  }

  try {
    await Promise.all(workers);
  } finally {
    if (tickInterval !== undefined) {
      clearInterval(tickInterval);
    }
  }

  return collector.snapshot();
}
