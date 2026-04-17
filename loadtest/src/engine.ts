import { Pool } from 'undici';
import { performance } from 'node:perf_hooks';
import type { RunConfig } from './config.js';

export interface RequestResult {
  latencyMs: number;
  statusCode: number | null;
  error: string | null;
  timestamp: number;
}

export class RequestEngine {
  private pool: Pool;

  constructor(origin: string, poolOptions?: ConstructorParameters<typeof Pool>[1]) {
    this.pool = new Pool(origin, poolOptions);
  }

  async fire(config: RunConfig): Promise<RequestResult> {
    const timestamp = Date.now();
    const start = performance.now();

    try {
      const response = await this.pool.request({
        path: new URL(config.url).pathname + (new URL(config.url).search ?? ''),
        method: config.method,
        headers: {
          ...config.headers,
          ...(config.body ? { 'content-type': 'application/json' } : {}),
        },
        body: config.body ?? null,
        bodyTimeout: config.timeout,
        headersTimeout: config.timeout,
      });

      const latencyMs = performance.now() - start;

      // Drain body to free the connection back to the pool
      await response.body.dump();

      return {
        latencyMs,
        statusCode: response.statusCode,
        error: null,
        timestamp,
      };
    } catch (err) {
      const latencyMs = performance.now() - start;
      return {
        latencyMs,
        statusCode: null,
        error: err instanceof Error ? err.message : String(err),
        timestamp,
      };
    }
  }

  async close(): Promise<void> {
    await this.pool.close();
  }
}
