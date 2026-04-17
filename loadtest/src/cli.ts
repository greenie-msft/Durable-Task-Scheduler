#!/usr/bin/env node
import { Command } from 'commander';
import { parseConfig } from './config.js';
import { RequestEngine } from './engine.js';
import { MetricsCollector } from './metrics.js';
import { LiveReporter, outputResults } from './reporter.js';
import { runScenario } from './scenarios/index.js';

const program = new Command();

program
  .name('loadtest')
  .description('HTTP load testing CLI')
  .version('0.1.0');

program
  .command('run')
  .description('Run a load test against a target URL')
  .requiredOption('--url <url>', 'Target URL to load test')
  .option('--method <method>', 'HTTP method (GET, POST, PUT, DELETE, PATCH)', 'GET')
  .option('--vus <number>', 'Number of virtual users (concurrent workers)', (v) => parseInt(v, 10), 10)
  .option('--duration <duration>', 'Test duration (e.g. 30s, 1m, 1m30s)', '30s')
  .option('--scenario <scenario>', 'Load scenario: constant, rampup, spike', 'constant')
  .option('--ramp-duration <duration>', 'Duration of the ramp-up phase (rampup scenario)')
  .option('--max-vus <number>', 'Maximum virtual users for rampup/spike scenarios', (v) => parseInt(v, 10))
  .option('--spike-duration <duration>', 'Duration of the spike window (spike scenario)')
  .option('--header <header>', 'HTTP header in "Name: Value" format (repeatable)', collect, [] as string[])
  .option('--body <body>', 'Request body string')
  .option('--output <format>', 'Output format: terminal, json, csv', 'terminal')
  .option('--timeout <duration>', 'Per-request timeout (e.g. 30s)', '30s')
  .action(async (opts) => {
    // Parse repeatable --header values into a Record<string, string>
    const headers: Record<string, string> = {};
    for (const h of opts.header as string[]) {
      const colon = h.indexOf(':');
      if (colon === -1) {
        console.error(`Invalid header format "${h}". Use "Name: Value".`);
        process.exit(1);
      }
      const name = h.slice(0, colon).trim();
      const value = h.slice(colon + 1).trim();
      headers[name] = value;
    }

    const rawConfig: Record<string, unknown> = {
      url: opts.url,
      method: opts.method,
      vus: opts.vus,
      duration: opts.duration,
      scenario: opts.scenario,
      headers,
      output: opts.output,
      timeout: opts.timeout,
    };

    if (opts.rampDuration !== undefined) rawConfig.rampDuration = opts.rampDuration;
    if (opts.maxVus !== undefined) rawConfig.maxVus = opts.maxVus;
    if (opts.spikeDuration !== undefined) rawConfig.spikeDuration = opts.spikeDuration;
    if (opts.body !== undefined) rawConfig.body = opts.body;

    let config;
    try {
      config = parseConfig(rawConfig);
    } catch (err) {
      console.error('Invalid configuration:');
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }

    const origin = new URL(config.url).origin;
    const engine = new RequestEngine(origin);
    const collector = new MetricsCollector();
    const reporter = new LiveReporter();

    reporter.start();

    try {
      await runScenario(config, engine, collector, (summary) => {
        reporter.tick(summary.rps, config.vus);
      });
      reporter.succeed('Load test complete');
    } catch (err) {
      reporter.stop();
      console.error('Load test failed:');
      console.error(err instanceof Error ? err.message : String(err));
      await engine.close().catch(() => undefined);
      process.exit(1);
    }

    await engine.close().catch(() => undefined);

    const summary = collector.snapshot();
    const points = collector.timeSeries();

    outputResults(config, summary, points);
  });

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

program.parse(process.argv);
