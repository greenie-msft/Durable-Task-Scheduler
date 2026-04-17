import type { RunConfig } from '../config.js';
import type { RequestEngine } from '../engine.js';
import type { MetricsCollector, MetricsSummary } from '../metrics.js';
import { runConstant } from './constant.js';
import { runRampup } from './rampup.js';
import { runSpike } from './spike.js';

export { runConstant } from './constant.js';
export { runRampup } from './rampup.js';
export { runSpike } from './spike.js';

/**
 * Dispatches to the appropriate scenario runner based on `config.scenario`.
 */
export async function runScenario(
  config: RunConfig,
  engine: RequestEngine,
  collector: MetricsCollector,
  onTick?: (summary: MetricsSummary) => void,
): Promise<MetricsSummary> {
  switch (config.scenario) {
    case 'constant':
      return runConstant(config, engine, collector, onTick);
    case 'rampup':
      return runRampup(config, engine, collector, onTick);
    case 'spike':
      return runSpike(config, engine, collector, onTick);
    default: {
      const _exhaustive: never = config.scenario;
      throw new Error(`Unknown scenario: ${_exhaustive}`);
    }
  }
}
