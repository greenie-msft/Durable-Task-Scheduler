import { describe, it, expect } from 'vitest';
import { parseDuration, parseConfig, RunConfigSchema } from '../src/config.js';

describe('parseDuration', () => {
  it('parses seconds', () => {
    expect(parseDuration('30s')).toBe(30_000);
    expect(parseDuration('1s')).toBe(1_000);
  });

  it('parses minutes', () => {
    expect(parseDuration('1m')).toBe(60_000);
    expect(parseDuration('2m')).toBe(120_000);
  });

  it('parses hours', () => {
    expect(parseDuration('1h')).toBe(3_600_000);
  });

  it('parses milliseconds', () => {
    expect(parseDuration('500ms')).toBe(500);
  });

  it('parses combined durations', () => {
    expect(parseDuration('1m30s')).toBe(90_000);
    expect(parseDuration('1h30m')).toBe(5_400_000);
    expect(parseDuration('1h1m1s')).toBe(3_661_000);
  });

  it('throws on invalid format', () => {
    expect(() => parseDuration('abc')).toThrow();
    expect(() => parseDuration('')).toThrow();
    expect(() => parseDuration('1x')).toThrow();
  });

  it('throws on zero duration', () => {
    expect(() => parseDuration('0s')).toThrow();
  });
});

describe('RunConfigSchema', () => {
  const base = { url: 'https://example.com', duration: '30s' };

  it('parses minimal valid config with defaults', () => {
    const result = RunConfigSchema.parse(base);
    expect(result.url).toBe('https://example.com');
    expect(result.duration).toBe(30_000);
    expect(result.method).toBe('GET');
    expect(result.headers).toEqual({});
    expect(result.vus).toBe(10);
    expect(result.scenario).toBe('constant');
    expect(result.output).toBe('terminal');
    expect(result.timeout).toBe(30_000);
  });

  it('accepts custom method', () => {
    const result = RunConfigSchema.parse({ ...base, method: 'POST' });
    expect(result.method).toBe('POST');
  });

  it('rejects invalid method', () => {
    expect(() => RunConfigSchema.parse({ ...base, method: 'FETCH' })).toThrow();
  });

  it('accepts headers', () => {
    const headers = { Authorization: 'Bearer token', 'X-Custom': 'value' };
    const result = RunConfigSchema.parse({ ...base, headers });
    expect(result.headers).toEqual(headers);
  });

  it('accepts optional body', () => {
    const result = RunConfigSchema.parse({ ...base, body: '{"key":"value"}' });
    expect(result.body).toBe('{"key":"value"}');
  });

  it('body is undefined when not provided', () => {
    const result = RunConfigSchema.parse(base);
    expect(result.body).toBeUndefined();
  });

  it('accepts custom vus', () => {
    const result = RunConfigSchema.parse({ ...base, vus: 50 });
    expect(result.vus).toBe(50);
  });

  it('rejects non-positive vus', () => {
    expect(() => RunConfigSchema.parse({ ...base, vus: 0 })).toThrow();
    expect(() => RunConfigSchema.parse({ ...base, vus: -1 })).toThrow();
  });

  it('parses duration string to ms', () => {
    const result = RunConfigSchema.parse({ ...base, duration: '1m' });
    expect(result.duration).toBe(60_000);
  });

  it('accepts all scenario types', () => {
    for (const scenario of ['constant', 'rampup', 'spike'] as const) {
      const result = RunConfigSchema.parse({ ...base, scenario });
      expect(result.scenario).toBe(scenario);
    }
  });

  it('rejects invalid scenario', () => {
    expect(() => RunConfigSchema.parse({ ...base, scenario: 'burst' })).toThrow();
  });

  it('accepts optional rampDuration and parses to ms', () => {
    const result = RunConfigSchema.parse({ ...base, rampDuration: '10s' });
    expect(result.rampDuration).toBe(10_000);
  });

  it('rampDuration is undefined when not provided', () => {
    const result = RunConfigSchema.parse(base);
    expect(result.rampDuration).toBeUndefined();
  });

  it('accepts optional maxVus', () => {
    const result = RunConfigSchema.parse({ ...base, maxVus: 100 });
    expect(result.maxVus).toBe(100);
  });

  it('maxVus is undefined when not provided', () => {
    const result = RunConfigSchema.parse(base);
    expect(result.maxVus).toBeUndefined();
  });

  it('accepts optional spikeDuration and parses to ms', () => {
    const result = RunConfigSchema.parse({ ...base, spikeDuration: '5s' });
    expect(result.spikeDuration).toBe(5_000);
  });

  it('accepts all output types', () => {
    for (const output of ['terminal', 'json', 'csv'] as const) {
      const result = RunConfigSchema.parse({ ...base, output });
      expect(result.output).toBe(output);
    }
  });

  it('rejects invalid output', () => {
    expect(() => RunConfigSchema.parse({ ...base, output: 'xml' })).toThrow();
  });

  it('accepts custom timeout', () => {
    const result = RunConfigSchema.parse({ ...base, timeout: '60s' });
    expect(result.timeout).toBe(60_000);
  });

  it('defaults timeout to 30s (30000ms)', () => {
    const result = RunConfigSchema.parse(base);
    expect(result.timeout).toBe(30_000);
  });

  it('rejects invalid URL', () => {
    expect(() => RunConfigSchema.parse({ ...base, url: 'not-a-url' })).toThrow();
  });

  it('requires url', () => {
    expect(() => RunConfigSchema.parse({ duration: '30s' })).toThrow();
  });

  it('requires duration', () => {
    expect(() => RunConfigSchema.parse({ url: 'https://example.com' })).toThrow();
  });
});

describe('parseConfig', () => {
  it('returns a valid RunConfig for valid input', () => {
    const config = parseConfig({ url: 'https://api.example.com', duration: '30s' });
    expect(config.url).toBe('https://api.example.com');
    expect(config.duration).toBe(30_000);
    expect(config.method).toBe('GET');
    expect(config.vus).toBe(10);
  });

  it('throws ZodError for invalid input', () => {
    expect(() => parseConfig({ url: 'bad', duration: '30s' })).toThrow();
    expect(() => parseConfig(null)).toThrow();
    expect(() => parseConfig({})).toThrow();
  });

  it('fully resolves optional scenario fields', () => {
    const config = parseConfig({
      url: 'https://api.example.com',
      duration: '2m',
      scenario: 'rampup',
      rampDuration: '30s',
      maxVus: 200,
    });
    expect(config.scenario).toBe('rampup');
    expect(config.rampDuration).toBe(30_000);
    expect(config.maxVus).toBe(200);
    expect(config.duration).toBe(120_000);
  });
});
