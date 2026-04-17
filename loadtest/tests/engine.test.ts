import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RequestEngine } from '../src/engine.js';
import type { RunConfig } from '../src/config.js';

// Minimal RunConfig fixture
function makeConfig(overrides: Partial<RunConfig> = {}): RunConfig {
  return {
    url: 'http://localhost:9999/test',
    method: 'GET',
    headers: {},
    body: undefined,
    vus: 1,
    duration: 5000,
    scenario: 'constant',
    output: 'terminal',
    timeout: 30000,
    ...overrides,
  };
}

describe('RequestEngine', () => {
  describe('RequestResult shape', () => {
    it('returns correct fields on a network error', async () => {
      // Port 9999 should have nothing listening → connection refused
      const engine = new RequestEngine('http://localhost:9999');
      const result = await engine.fire(makeConfig());

      expect(result).toHaveProperty('latencyMs');
      expect(result).toHaveProperty('statusCode');
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('timestamp');

      expect(typeof result.latencyMs).toBe('number');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.statusCode).toBeNull();
      expect(typeof result.error).toBe('string');
      expect(result.error).not.toBeNull();
      expect(typeof result.timestamp).toBe('number');
      expect(result.timestamp).toBeGreaterThan(0);

      await engine.close();
    });
  });

  describe('undici Pool integration (mocked)', () => {
    let mockRequest: ReturnType<typeof vi.fn>;
    let mockClose: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      mockClose = vi.fn().mockResolvedValue(undefined);
      mockRequest = vi.fn().mockResolvedValue({
        statusCode: 200,
        body: { dump: vi.fn().mockResolvedValue(undefined) },
      });

      // Patch Pool prototype methods
      const { Pool } = await import('undici');
      vi.spyOn(Pool.prototype, 'request').mockImplementation(mockRequest);
      vi.spyOn(Pool.prototype, 'close').mockImplementation(mockClose);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('returns statusCode and null error on success', async () => {
      const engine = new RequestEngine('http://example.com');
      const result = await engine.fire(makeConfig({ url: 'http://example.com/path' }));

      expect(result.statusCode).toBe(200);
      expect(result.error).toBeNull();
      expect(typeof result.latencyMs).toBe('number');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.timestamp).toBe('number');

      await engine.close();
    });

    it('passes method and headers to undici pool', async () => {
      const engine = new RequestEngine('http://example.com');
      await engine.fire(
        makeConfig({
          url: 'http://example.com/api',
          method: 'POST',
          headers: { authorization: 'Bearer token' },
          body: '{"key":"value"}',
        }),
      );

      expect(mockRequest).toHaveBeenCalledOnce();
      const callArgs = mockRequest.mock.calls[0][0];
      expect(callArgs.method).toBe('POST');
      expect(callArgs.headers).toMatchObject({ authorization: 'Bearer token' });
      expect(callArgs.body).toBe('{"key":"value"}');

      await engine.close();
    });

    it('records a non-null timestamp', async () => {
      const before = Date.now();
      const engine = new RequestEngine('http://example.com');
      const result = await engine.fire(makeConfig({ url: 'http://example.com/' }));
      const after = Date.now();

      expect(result.timestamp).toBeGreaterThanOrEqual(before);
      expect(result.timestamp).toBeLessThanOrEqual(after);

      await engine.close();
    });

    it('captures error string when pool throws', async () => {
      mockRequest.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

      const engine = new RequestEngine('http://example.com');
      const result = await engine.fire(makeConfig({ url: 'http://example.com/' }));

      expect(result.statusCode).toBeNull();
      expect(result.error).toBe('connect ECONNREFUSED');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);

      await engine.close();
    });

    it('coerces non-Error throw to string', async () => {
      // Covers the `String(err)` branch in the catch block
      mockRequest.mockRejectedValueOnce('raw string error');

      const engine = new RequestEngine('http://example.com');
      const result = await engine.fire(makeConfig({ url: 'http://example.com/' }));

      expect(result.statusCode).toBeNull();
      expect(result.error).toBe('raw string error');

      await engine.close();
    });

    it('sets content-type header when body is provided', async () => {
      const engine = new RequestEngine('http://example.com');
      await engine.fire(
        makeConfig({ url: 'http://example.com/', body: '{"x":1}' }),
      );

      const callArgs = mockRequest.mock.calls[0][0];
      expect(callArgs.headers).toMatchObject({ 'content-type': 'application/json' });

      await engine.close();
    });

    it('does not set content-type header when body is absent', async () => {
      const engine = new RequestEngine('http://example.com');
      await engine.fire(makeConfig({ url: 'http://example.com/', body: undefined }));

      const callArgs = mockRequest.mock.calls[0][0];
      expect(callArgs.headers).not.toHaveProperty('content-type');

      await engine.close();
    });

    it('preserves query string in the request path', async () => {
      const engine = new RequestEngine('http://example.com');
      await engine.fire(makeConfig({ url: 'http://example.com/path?foo=bar' }));

      const callArgs = mockRequest.mock.calls[0][0];
      expect(callArgs.path).toBe('/path?foo=bar');

      await engine.close();
    });

    it('records 4xx status codes as non-null statusCode', async () => {
      mockRequest.mockResolvedValueOnce({
        statusCode: 404,
        body: { dump: vi.fn().mockResolvedValue(undefined) },
      });

      const engine = new RequestEngine('http://example.com');
      const result = await engine.fire(makeConfig({ url: 'http://example.com/' }));

      expect(result.statusCode).toBe(404);
      expect(result.error).toBeNull();

      await engine.close();
    });

    it('records 5xx status codes as non-null statusCode', async () => {
      mockRequest.mockResolvedValueOnce({
        statusCode: 503,
        body: { dump: vi.fn().mockResolvedValue(undefined) },
      });

      const engine = new RequestEngine('http://example.com');
      const result = await engine.fire(makeConfig({ url: 'http://example.com/' }));

      expect(result.statusCode).toBe(503);
      expect(result.error).toBeNull();

      await engine.close();
    });
  });
});
