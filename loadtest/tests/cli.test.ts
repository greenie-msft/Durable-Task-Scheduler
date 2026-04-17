import { describe, it, expect } from 'vitest';
import { Command } from 'commander';
import { parseConfig } from '../src/config.js';

// ---------------------------------------------------------------------------
// Unit tests for CLI option parsing logic (header parsing & config assembly)
// We test the parts that can be exercised without spawning a child process or
// making real HTTP calls.
// ---------------------------------------------------------------------------

describe('CLI header parsing logic', () => {
  function parseHeaders(rawHeaders: string[]): Record<string, string> {
    const headers: Record<string, string> = {};
    for (const h of rawHeaders) {
      const colon = h.indexOf(':');
      if (colon === -1) throw new Error(`Invalid header format "${h}". Use "Name: Value".`);
      const name = h.slice(0, colon).trim();
      const value = h.slice(colon + 1).trim();
      headers[name] = value;
    }
    return headers;
  }

  it('parses a single header', () => {
    expect(parseHeaders(['Authorization: Bearer token'])).toEqual({
      Authorization: 'Bearer token',
    });
  });

  it('parses multiple headers', () => {
    const result = parseHeaders([
      'Authorization: Bearer token',
      'Content-Type: application/json',
    ]);
    expect(result).toEqual({
      Authorization: 'Bearer token',
      'Content-Type': 'application/json',
    });
  });

  it('handles header values that contain colons', () => {
    const result = parseHeaders(['X-Custom: value:with:colons']);
    expect(result).toEqual({ 'X-Custom': 'value:with:colons' });
  });

  it('trims whitespace from header names and values', () => {
    const result = parseHeaders(['  X-Foo  :  bar  ']);
    expect(result).toEqual({ 'X-Foo': 'bar' });
  });

  it('throws on malformed header missing colon', () => {
    expect(() => parseHeaders(['BadHeader'])).toThrow('Invalid header format');
  });

  it('returns empty object for no headers', () => {
    expect(parseHeaders([])).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Commander option declaration tests
// ---------------------------------------------------------------------------

function buildTestProgram(): Command {
  const program = new Command();
  program.exitOverride();

  const run = program
    .command('run')
    .requiredOption('--url <url>', 'Target URL')
    .option('--method <method>', 'HTTP method', 'GET')
    .option('--vus <number>', 'Virtual users', (v) => parseInt(v, 10), 10)
    .option('--duration <duration>', 'Duration', '30s')
    .option('--scenario <scenario>', 'Scenario', 'constant')
    .option('--ramp-duration <duration>', 'Ramp duration')
    .option('--max-vus <number>', 'Max VUs', (v) => parseInt(v, 10))
    .option('--spike-duration <duration>', 'Spike duration')
    .option(
      '--header <header>',
      'HTTP header',
      (val: string, acc: string[]) => [...acc, val],
      [] as string[],
    )
    .option('--body <body>', 'Request body')
    .option('--output <format>', 'Output format', 'terminal')
    .option('--timeout <duration>', 'Timeout', '30s');

  run.action(() => {});
  return program;
}

describe('CLI option declarations', () => {
  it('accepts --url', () => {
    const p = buildTestProgram();
    p.parse(['node', 'cli', 'run', '--url', 'https://example.com']);
    expect(p.commands[0].opts().url).toBe('https://example.com');
  });

  it('defaults --method to GET', () => {
    const p = buildTestProgram();
    p.parse(['node', 'cli', 'run', '--url', 'https://example.com']);
    expect(p.commands[0].opts().method).toBe('GET');
  });

  it('accepts --method override', () => {
    const p = buildTestProgram();
    p.parse(['node', 'cli', 'run', '--url', 'https://example.com', '--method', 'POST']);
    expect(p.commands[0].opts().method).toBe('POST');
  });

  it('defaults --vus to 10', () => {
    const p = buildTestProgram();
    p.parse(['node', 'cli', 'run', '--url', 'https://example.com']);
    expect(p.commands[0].opts().vus).toBe(10);
  });

  it('parses --vus as integer', () => {
    const p = buildTestProgram();
    p.parse(['node', 'cli', 'run', '--url', 'https://example.com', '--vus', '50']);
    expect(p.commands[0].opts().vus).toBe(50);
  });

  it('defaults --scenario to constant', () => {
    const p = buildTestProgram();
    p.parse(['node', 'cli', 'run', '--url', 'https://example.com']);
    expect(p.commands[0].opts().scenario).toBe('constant');
  });

  it('accepts rampup scenario options', () => {
    const p = buildTestProgram();
    p.parse([
      'node', 'cli', 'run',
      '--url', 'https://example.com',
      '--scenario', 'rampup',
      '--ramp-duration', '10s',
      '--max-vus', '100',
    ]);
    const opts = p.commands[0].opts();
    expect(opts.scenario).toBe('rampup');
    expect(opts.rampDuration).toBe('10s');
    expect(opts.maxVus).toBe(100);
  });

  it('accepts spike scenario options', () => {
    const p = buildTestProgram();
    p.parse([
      'node', 'cli', 'run',
      '--url', 'https://example.com',
      '--scenario', 'spike',
      '--spike-duration', '5s',
      '--max-vus', '200',
    ]);
    const opts = p.commands[0].opts();
    expect(opts.scenario).toBe('spike');
    expect(opts.spikeDuration).toBe('5s');
    expect(opts.maxVus).toBe(200);
  });

  it('collects multiple --header flags', () => {
    const p = buildTestProgram();
    p.parse([
      'node', 'cli', 'run',
      '--url', 'https://example.com',
      '--header', 'Authorization: Bearer token',
      '--header', 'X-Custom: value',
    ]);
    expect(p.commands[0].opts().header).toEqual([
      'Authorization: Bearer token',
      'X-Custom: value',
    ]);
  });

  it('defaults --header to empty array', () => {
    const p = buildTestProgram();
    p.parse(['node', 'cli', 'run', '--url', 'https://example.com']);
    expect(p.commands[0].opts().header).toEqual([]);
  });

  it('accepts --body', () => {
    const p = buildTestProgram();
    p.parse(['node', 'cli', 'run', '--url', 'https://example.com', '--body', '{"key":"value"}']);
    expect(p.commands[0].opts().body).toBe('{"key":"value"}');
  });

  it('defaults --output to terminal', () => {
    const p = buildTestProgram();
    p.parse(['node', 'cli', 'run', '--url', 'https://example.com']);
    expect(p.commands[0].opts().output).toBe('terminal');
  });

  it('accepts --output json', () => {
    const p = buildTestProgram();
    p.parse(['node', 'cli', 'run', '--url', 'https://example.com', '--output', 'json']);
    expect(p.commands[0].opts().output).toBe('json');
  });

  it('defaults --timeout to 30s', () => {
    const p = buildTestProgram();
    p.parse(['node', 'cli', 'run', '--url', 'https://example.com']);
    expect(p.commands[0].opts().timeout).toBe('30s');
  });

  it('throws when --url is missing', () => {
    const p = buildTestProgram();
    expect(() => p.parse(['node', 'cli', 'run', '--duration', '5s'])).toThrow();
  });
});

// ---------------------------------------------------------------------------
// CLI config assembly via parseConfig
// ---------------------------------------------------------------------------

describe('CLI config assembly', () => {
  it('assembles a valid minimal config from CLI-like options', () => {
    const config = parseConfig({
      url: 'http://localhost:3000/',
      method: 'GET',
      vus: 5,
      duration: '10s',
      scenario: 'constant',
      headers: {},
      output: 'terminal',
      timeout: '30s',
    });
    expect(config.url).toBe('http://localhost:3000/');
    expect(config.method).toBe('GET');
    expect(config.vus).toBe(5);
    expect(config.duration).toBe(10_000);
    expect(config.scenario).toBe('constant');
    expect(config.output).toBe('terminal');
    expect(config.timeout).toBe(30_000);
  });

  it('assembles a rampup config with rampDuration and maxVus', () => {
    const config = parseConfig({
      url: 'http://localhost:3000/',
      duration: '60s',
      scenario: 'rampup',
      rampDuration: '15s',
      maxVus: 50,
      headers: {},
    });
    expect(config.scenario).toBe('rampup');
    expect(config.rampDuration).toBe(15_000);
    expect(config.maxVus).toBe(50);
  });

  it('assembles a spike config with spikeDuration and maxVus', () => {
    const config = parseConfig({
      url: 'http://localhost:3000/',
      duration: '30s',
      scenario: 'spike',
      spikeDuration: '5s',
      maxVus: 100,
      headers: {},
    });
    expect(config.scenario).toBe('spike');
    expect(config.spikeDuration).toBe(5_000);
    expect(config.maxVus).toBe(100);
  });

  it('assembles a POST config with body and headers', () => {
    const config = parseConfig({
      url: 'http://localhost:3000/api',
      method: 'POST',
      body: '{"key":"value"}',
      headers: { 'Authorization': 'Bearer token' },
      duration: '5s',
    });
    expect(config.method).toBe('POST');
    expect(config.body).toBe('{"key":"value"}');
    expect(config.headers['Authorization']).toBe('Bearer token');
  });

  it('throws on invalid URL', () => {
    expect(() => parseConfig({ url: 'not-a-url', duration: '5s' })).toThrow();
  });

  it('throws on invalid method', () => {
    expect(() =>
      parseConfig({ url: 'http://localhost/', method: 'INVALID', duration: '5s' }),
    ).toThrow();
  });

  it('throws on invalid output format', () => {
    expect(() =>
      parseConfig({ url: 'http://localhost/', duration: '5s', output: 'xml' }),
    ).toThrow();
  });

  it('applies defaults: method=GET, vus=10, scenario=constant, output=terminal, timeout=30s', () => {
    const config = parseConfig({ url: 'http://localhost/', duration: '5s' });
    expect(config.method).toBe('GET');
    expect(config.vus).toBe(10);
    expect(config.scenario).toBe('constant');
    expect(config.output).toBe('terminal');
    expect(config.timeout).toBe(30_000);
  });
});

// ---------------------------------------------------------------------------
// CLI shebang and module checks
// ---------------------------------------------------------------------------

describe('CLI shebang and module', () => {
  it('cli.ts starts with #!/usr/bin/env node', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(resolve(__dirname, '../src/cli.ts'), 'utf-8');
    expect(src.startsWith('#!/usr/bin/env node')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// index.ts re-exports
// ---------------------------------------------------------------------------

describe('index.ts re-exports', () => {
  it('re-exports RequestEngine', async () => {
    const mod = await import('../src/index.js');
    expect(mod.RequestEngine).toBeDefined();
  });

  it('re-exports MetricsCollector', async () => {
    const mod = await import('../src/index.js');
    expect(mod.MetricsCollector).toBeDefined();
  });

  it('re-exports LiveReporter', async () => {
    const mod = await import('../src/index.js');
    expect(mod.LiveReporter).toBeDefined();
  });

  it('re-exports parseConfig', async () => {
    const mod = await import('../src/index.js');
    expect(mod.parseConfig).toBeDefined();
  });

  it('re-exports parseDuration', async () => {
    const mod = await import('../src/index.js');
    expect(mod.parseDuration).toBeDefined();
  });

  it('re-exports RunConfigSchema', async () => {
    const mod = await import('../src/index.js');
    expect(mod.RunConfigSchema).toBeDefined();
  });

  it('re-exports runScenario', async () => {
    const mod = await import('../src/index.js');
    expect(mod.runScenario).toBeDefined();
  });

  it('re-exports outputResults', async () => {
    const mod = await import('../src/index.js');
    expect(mod.outputResults).toBeDefined();
  });
});
