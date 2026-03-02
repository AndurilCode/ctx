import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { patch } from '../../../src/core/patch.js';
import { locateSymbol } from '../../../src/parser/patch-engine.js';

const SAMPLE = [
  'export function greet(name: string): string {',
  '  return `Hello, ${name}!`;',
  '}',
  '',
  'export function farewell(name: string): string {',
  '  return `Goodbye, ${name}!`;',
  '}',
  '',
].join('\n');

/** Get the real hash from locateSymbol for a given symbol in source. */
async function hashOf(source: string, name: string): Promise<string> {
  const loc = await locateSymbol(source, name, { language: 'ts' });
  if (!loc) throw new Error(`Symbol "${name}" not found`);
  return loc.hash;
}

describe('patch — single symbol', () => {
  let tempDir: string;
  let filePath: string;

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });

  async function setup(content = SAMPLE) {
    tempDir = await mkdtemp(join(tmpdir(), 'ctx-patch-'));
    filePath = join(tempDir, 'sample.ts');
    await writeFile(filePath, content, 'utf8');
    return filePath;
  }

  test('replaces a symbol by name + hash', async () => {
    await setup();
    const greetHash = await hashOf(SAMPLE, 'greet');
    const result = await patch({
      file: filePath,
      symbol: 'greet',
      hash: greetHash,
      body: 'function greet(name: string): string {\n  return `Hi, ${name}!`;\n}',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.linesChanged).toBeGreaterThan(0);
    const content = await readFile(filePath, 'utf8');
    expect(content).toContain('Hi, ${name}!');
    expect(content).toContain('Goodbye, ${name}!');
  });

  test('returns STALE_READ on hash mismatch', async () => {
    await setup();
    const result = await patch({
      file: filePath,
      symbol: 'greet',
      hash: 'dead',
      body: 'function greet(): string { return "x"; }',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('STALE_READ');
      expect(result.error.freshOutline).toBeDefined();
    }
  });

  test('returns SYMBOL_NOT_FOUND for missing symbol', async () => {
    await setup();
    const result = await patch({
      file: filePath,
      symbol: 'nonExistent',
      hash: 'abcd',
      body: 'function nonExistent() {}',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('SYMBOL_NOT_FOUND');
  });

  test('dry-run returns diff without writing', async () => {
    await setup();
    const greetHash = await hashOf(SAMPLE, 'greet');
    const result = await patch({
      file: filePath,
      symbol: 'greet',
      hash: greetHash,
      body: 'function greet(): string { return "dry"; }',
      dryRun: true,
    });
    expect(result.ok).toBe(true);
    const content = await readFile(filePath, 'utf8');
    expect(content).toContain('Hello, ${name}!');
  });
});
