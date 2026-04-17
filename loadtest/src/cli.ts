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
  .description('Load testing CLI for HTTP endpoints')
  .version('0.1.0');

program
  .command('run')
  .description('Run a load test against a URL')
  .requiredOption('--url <url>', 'Target URL to load test')
  .option('--method <method>', 'HTTP method (GET, POST, PUT, DELETE, PATCH)', 'GET')
  .option('--vus <number>', 'Number of virtual users', (v) => parseInt(v, 10), 10)
  .option('--duration <duration>', 'Test duration (e.g. 30s, 1m)')
  .option('--scenario <scenario>', 'Load scenario: constant, rampup, spike', 'constant')
  .option('--ramp-duration <duration>', 'Ramp-up duration for rampup scenario (e.g. 10s)')
  .option('--max-vus <number>', 'Maximum VUs for rampup/spike scenarios', (v) => parseInt(v, 10))
  .option('--spike-duration <duration>', 'Duration of spike window for spike scenario (e.g. 5s)')
  .option(
    '--header <header>',
    'HTTP header in "Name: Value" format (repeatable)',
    (val: string, acc: string[]) => [...acc, val],
    [] as string[],
  )
  .option('--body <body>', 'Request body string')
  .option('--output <format>', 'Output format: terminal, json, csv', 'terminal')
  .option('--timeout <duration>', 'Per-request timeout (e.g. 30s)', '30s')
  .action(async (opts) => {
    try {
      // Parse repeatable --header "Name: Value" flags into a record.
      const headers: Record<string, string> = {};
      for (const h of opts.header as string[]) {
        const idx = h.indexOf(':');
        if (idx < 0) {
          console.error(`Error: Invalid header format "${h}". Expected "Name: Value".`);
          process.exit(1);
        }
        headers[h.slice(0, idx).trim()] = h.slice(idx + 1).trim();
      }

      const config = parseConfig({
        url: opts.url,
        method: opts.method,
        vus: opts.vus,
        duration: opts.duration,
        scenario: opts.scenario,
        rampDuration: opts.rampDuration,
        maxVus: opts.maxVus,
        spikeDuration: opts.spikeDuration,
        headers,
        body: opts.body,
        output: opts.output,
        timeout: opts.timeout,
      });

      const origin = new URL(config.url).origin;
      const engine = new RequestEngine(origin);
      const collector = new MetricsCollector();
      const reporter = new LiveReporter();

      reporter.start();

      const targetVus = config.maxVus ?? config.vus;
      const summary = await runScenario(config, engine, collector, (snap) => {
        reporter.tick(snap.rps, targetVus);
      });

      reporter.succeed('Load test complete');

      outputResults(config, summary, collector.timeSeries());

      await engine.close();
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program.parse();
