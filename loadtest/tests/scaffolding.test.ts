import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'));

describe('project scaffolding', () => {
  it('has a bin entry pointing to dist/cli.js', () => {
    expect(pkg.bin).toBeDefined();
    const binEntry = typeof pkg.bin === 'string' ? pkg.bin : Object.values(pkg.bin)[0];
    expect(binEntry).toBe('dist/cli.js');
  });

  it('has required runtime dependencies', () => {
    const deps = Object.keys(pkg.dependencies ?? {});
    for (const dep of ['undici', 'commander', 'zod', 'cli-table3', 'ora', 'chalk']) {
      expect(deps, `missing dependency: ${dep}`).toContain(dep);
    }
  });

  it('has required dev dependencies', () => {
    const devDeps = Object.keys(pkg.devDependencies ?? {});
    for (const dep of ['typescript', 'vitest', '@types/node']) {
      expect(devDeps, `missing devDependency: ${dep}`).toContain(dep);
    }
  });

  it('has required npm scripts', () => {
    const scripts = Object.keys(pkg.scripts ?? {});
    for (const script of ['build', 'dev', 'test', 'lint']) {
      expect(scripts, `missing script: ${script}`).toContain(script);
    }
  });

  it('build script uses tsc', () => {
    expect(pkg.scripts.build).toContain('tsc');
  });

  it('test script uses vitest', () => {
    expect(pkg.scripts.test).toContain('vitest');
  });
});
