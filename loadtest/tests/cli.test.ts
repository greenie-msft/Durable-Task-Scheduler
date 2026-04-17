import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
    expect(() =>
      parseConfig({ url: 'not-a-url', duration: '5s' }),
    ).toThrow();
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
