import type { RunConfig } from '../config.js';
import type { RequestEngine } from '../engine.js';
import type { MetricsCollector, MetricsSummary } from '../metrics.js';

/**
 * Runs a spike scenario: holds `config.vus` baseline workers for the full
 * duration, then at the midpoint instantly spawns `config.maxVus` additional
 * spike workers that run for `config.spikeDuration` before dropping back to
 * the baseline.
 *
 * Calls `onTick` once per second with a live snapshot.
 * Returns the final summary when all workers have stopped.
 */
export async function runSpike(
  config: RunConfig,
  engine: RequestEngine,
  collector: MetricsCollector,
  onTick?: (summary: MetricsSummary) => void,
): Promise<MetricsSummary> {
  const maxVus = config.maxVus ?? config.vus;
  const spikeDuration = config.spikeDuration ?? Math.floor(config.duration * 0.1);

  const startTime = Date.now();
  const deadline = startTime + config.duration;
  const midpoint = startTime + Math.floor(config.duration / 2);
  const spikeDeadline = midpoint + spikeDuration;

  const workers: Promise<void>[] = [];
  let spikeSpawned = false;

  function makeWorkerLoop(workerDeadline: number): () => Promise<void> {
    return async function workerLoop(): Promise<void> {
      while (Date.now() < workerDeadline) {
        const result = await engine.fire(config);
        collector.record(result);
      }
    };
  }

  // Spawn baseline workers — they run until the overall deadline.
  for (let i = 0; i < config.vus; i++) {
    workers.push(makeWorkerLoop(deadline)());
  }

  let tickInterval: ReturnType<typeof setInterval> | undefined;
  if (onTick) {
    tickInterval = setInterval(() => {
      onTick(collector.snapshot());
    }, 1000);
  }

  // Poll for the midpoint to trigger the spike.
  const spikeCheck = setInterval(() => {
    if (!spikeSpawned && Date.now() >= midpoint) {
      spikeSpawned = true;
      for (let i = 0; i < maxVus; i++) {
        workers.push(makeWorkerLoop(spikeDeadline)());
      }
    }
  }, 50);

  await new Promise<void>(resolve => setTimeout(resolve, config.duration));

  clearInterval(spikeCheck);
  if (tickInterval !== undefined) {
    clearInterval(tickInterval);
  }

  await Promise.all(workers);

  return collector.snapshot();
}
