import { z } from 'zod';

/**
 * Parses a duration string like '30s', '1m', '1m30s', '500ms' into milliseconds.
 * Supported units: h (hours), m (minutes), s (seconds), ms (milliseconds).
 */
export function parseDuration(value: string): number {
  const str = value.trim();
  // Match tokens like '1h', '30m', '15s', '500ms' in order
  const tokenRe = /(\d+)(h|ms|m|s)/g;
  let ms = 0;
  let lastIndex = 0;
  let token: RegExpExecArray | null;

  while ((token = tokenRe.exec(str)) !== null) {
    if (token.index !== lastIndex) {
      throw new Error(`Invalid duration: "${value}". Use formats like '30s', '1m', '1m30s'.`);
    }
    const num = parseInt(token[1], 10);
    switch (token[2]) {
      case 'h':  ms += num * 3_600_000; break;
      case 'm':  ms += num * 60_000;    break;
      case 's':  ms += num * 1_000;     break;
      case 'ms': ms += num;             break;
    }
    lastIndex = tokenRe.lastIndex;
  }

  if (lastIndex !== str.length || str.length === 0) {
    throw new Error(`Invalid duration: "${value}". Use formats like '30s', '1m', '1m30s'.`);
  }
  if (ms <= 0) {
    throw new Error(`Duration must be greater than zero: "${value}".`);
  }
  return ms;
}

const DurationMs = z.string().transform((val, ctx) => {
  try {
    return parseDuration(val);
  } catch (err) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: (err as Error).message });
    return z.NEVER;
  }
});

export const RunConfigSchema = z.object({
  url: z.string().url(),

  method: z
    .enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
    .default('GET'),

  headers: z.record(z.string(), z.string()).default({}),

  body: z.string().optional(),

  vus: z.number().int().positive().default(10),

  duration: DurationMs,

  scenario: z
    .enum(['constant', 'rampup', 'spike'])
    .default('constant'),

  rampDuration: DurationMs.optional(),

  maxVus: z.number().int().positive().optional(),

  spikeDuration: DurationMs.optional(),

  output: z
    .enum(['terminal', 'json', 'csv'])
    .default('terminal'),

  timeout: DurationMs.default('30s'),
});

export type RunConfig = z.infer<typeof RunConfigSchema>;

/**
 * Validates and parses raw config input, returning a fully-typed RunConfig.
 * Throws a ZodError on validation failure.
 */
export function parseConfig(input: unknown): RunConfig {
  return RunConfigSchema.parse(input);
}
