import ora, { type Ora } from 'ora';
import Table from 'cli-table3';
import chalk from 'chalk';
import type { MetricsSummary, TimeSeriesPoint } from './metrics.js';
import type { RunConfig } from './config.js';

// ---------------------------------------------------------------------------
// Live reporter
// ---------------------------------------------------------------------------

export class LiveReporter {
  private spinner: Ora;
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
    this.spinner = ora({ text: 'Starting…', spinner: 'dots' });
  }

  start(): void {
    this.startTime = Date.now();
    this.spinner.start();
  }

  /** Call on every tick to refresh the spinner line. */
  tick(rps: number, vus: number): void {
    const elapsedSec = ((Date.now() - this.startTime) / 1000).toFixed(1);
    this.spinner.text =
      `Elapsed: ${chalk.cyan(elapsedSec + 's')}  ` +
      `RPS: ${chalk.yellow(rps.toFixed(1))}  ` +
      `VUs: ${chalk.green(String(vus))}`;
  }

  stop(): void {
    this.spinner.stop();
  }

  /** Stop with a success indicator and optional message. */
  succeed(message?: string): void {
    this.spinner.succeed(message ?? 'Done');
  }
}

// ---------------------------------------------------------------------------
// Summary table
// ---------------------------------------------------------------------------

export function printSummary(summary: MetricsSummary): void {
  const table = new Table({
    head: [
      chalk.bold('Metric'),
      chalk.bold('Value'),
    ],
    style: { head: [], border: [] },
  });

  const ms = (v: number) => `${v.toFixed(2)} ms`;
  const rpsColor = summary.rps >= 10 ? chalk.green : chalk.yellow;
  const errorRate = summary.total > 0 ? summary.fail / summary.total : 0;
  const errorColor = errorRate > 0.05 ? chalk.red : errorRate > 0 ? chalk.yellow : chalk.green;

  table.push(
    [chalk.white('Total Requests'), chalk.white(String(summary.total))],
    [chalk.green('Successes'), chalk.green(String(summary.success))],
    [errorColor('Failures'), errorColor(String(summary.fail))],
    [rpsColor('RPS (avg)'), rpsColor(summary.rps.toFixed(2))],
    [chalk.cyan('Latency min'), chalk.cyan(ms(summary.latency.min))],
    [chalk.cyan('Latency mean'), chalk.cyan(ms(summary.latency.mean))],
    [chalk.cyan('Latency p50'), chalk.cyan(ms(summary.latency.p50))],
    [chalk.cyan('Latency p90'), chalk.cyan(ms(summary.latency.p90))],
    [chalk.cyan('Latency p95'), chalk.cyan(ms(summary.latency.p95))],
    [
      summary.latency.p99 > 1000 ? chalk.red('Latency p99') : chalk.cyan('Latency p99'),
      summary.latency.p99 > 1000 ? chalk.red(ms(summary.latency.p99)) : chalk.cyan(ms(summary.latency.p99)),
    ],
    [chalk.cyan('Latency max'), chalk.cyan(ms(summary.latency.max))],
  );

  console.log(table.toString());
}

// ---------------------------------------------------------------------------
// Export helpers
// ---------------------------------------------------------------------------

export function exportJson(summary: MetricsSummary): string {
  return JSON.stringify(summary, null, 2);
}

export function exportCsv(points: TimeSeriesPoint[]): string {
  const lines: string[] = ['timestamp,rps,p50,p99,errors'];
  for (const p of points) {
    // TimeSeriesPoint doesn't carry per-bucket percentiles; use meanLatencyMs
    // as a best-effort p50 approximation; p99 is unavailable so we emit 0.
    lines.push(`${p.second},${p.rps},${p.meanLatencyMs.toFixed(2)},0,${p.failures}`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Output format wiring
// ---------------------------------------------------------------------------

/**
 * Renders or returns the final results according to `config.output`.
 *
 * - `terminal`: prints a colour-coded table to stdout
 * - `json`:     writes formatted JSON to stdout
 * - `csv`:      writes CSV rows to stdout (caller must supply time-series points)
 */
export function outputResults(
  config: Pick<RunConfig, 'output'>,
  summary: MetricsSummary,
  points: TimeSeriesPoint[] = [],
): void {
  switch (config.output) {
    case 'json':
      process.stdout.write(exportJson(summary) + '\n');
      break;
    case 'csv':
      process.stdout.write(exportCsv(points) + '\n');
      break;
    case 'terminal':
    default:
      printSummary(summary);
      break;
  }
}
