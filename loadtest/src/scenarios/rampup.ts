import type { RunConfig } from '../config.js';
import type { RequestEngine } from '../engine.js';
import type { MetricsCollector, MetricsSummary } from '../metrics.js';

/**
 * Runs a ramp-up scenario: linearly increases the number of active VUs from 0
 * to `config.maxVus` over `config.rampDuration`, then holds at `config.maxVus`
 * until the total `config.duration` elapses.
 *
 * New workers are spawned at each check interval to match the linear ramp target.
 * Once spawned, each worker loops engine.fire() → collector.record() until the
 * overall deadline.
 *
 * Calls `onTick` once per second with a live snapshot.
 * Returns the final summary when all workers have stopped.
 */
export async function runRampup(
  config: RunConfig,
  engine: RequestEngine,
  collector: MetricsCollector,
  onTick?: (summary: MetricsSummary) => void,
): Promise<MetricsSummary> {
  const maxVus = config.maxVus ?? config.vus;
  const rampDuration = config.rampDuration ?? config.duration;
  const startTime = Date.now();
  const deadline = startTime + config.duration;

  const workers: Promise<void>[] = [];
  let spawned = 0;

  async function workerLoop(): Promise<void> {
    while (Date.now() < deadline) {
      const result = await engine.fire(config);
      collector.record(result);
    }
  }

  function spawnIfNeeded(): void {
    const elapsed = Date.now() - startTime;
    const target =
      elapsed >= rampDuration
        ? maxVus
        : Math.floor((elapsed / rampDuration) * maxVus);

    while (spawned < target) {
      spawned++;
      workers.push(workerLoop());
    }
  }

  let tickInterval: ReturnType<typeof setInterval> | undefined;
  if (onTick) {
    tickInterval = setInterval(() => {
      onTick(collector.snapshot());
    }, 1000);
  }

  // Check ~10 times per second so the ramp is smooth.
  const rampInterval = setInterval(spawnIfNeeded, 100);

  await new Promise<void>(resolve => setTimeout(resolve, config.duration));

  clearInterval(rampInterval);
  if (tickInterval !== undefined) {
    clearInterval(tickInterval);
  }

  // Ensure the full maxVus pool was spawned (catches cases where the final
  // interval fires just after the setTimeout resolves).
  while (spawned < maxVus) {
    spawned++;
    workers.push(workerLoop());
  }

  await Promise.all(workers);

  return collector.snapshot();
}
