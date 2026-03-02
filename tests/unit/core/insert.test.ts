import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { insert } from '../../../src/core/insert.js';

const SAMPLE = [
  "import { readFile } from 'node:fs/promises';",
  '',
  'export function greet(name: string): string {',
  '  return `Hello, ${name}!`;',
  '}',
  '',
].join('\n');

describe('insert', () => {
  let tempDir: string;
  let filePath: string;

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });

  async function setup(content = SAMPLE) {
    tempDir = await mkdtemp(join(tmpdir(), 'ctx-insert-'));
    filePath = join(tempDir, 'sample.ts');
    await writeFile(filePath, content, 'utf8');
    return filePath;
  }

  test('inserts after a named symbol', async () => {
    await setup();
    const result = await insert({
      file: filePath,
      position: 'after:greet',
      body: 'export function wave(): string {\n  return "wave";\n}',
    });
    expect(result.ok).toBe(true);
    const content = await readFile(filePath, 'utf8');
    expect(content).toContain('wave');
    const greetIdx = content.indexOf('function greet');
    const waveIdx = content.indexOf('function wave');
    expect(waveIdx).toBeGreaterThan(greetIdx);
  });

  test('inserts before a named symbol', async () => {
    await setup();
    const result = await insert({
      file: filePath,
      position: 'before:greet',
      body: 'export function wave(): string {\n  return "wave";\n}',
    });
    expect(result.ok).toBe(true);
    const content = await readFile(filePath, 'utf8');
    const greetIdx = content.indexOf('function greet');
    const waveIdx = content.indexOf('function wave');
    expect(waveIdx).toBeLessThan(greetIdx);
  });

  test('inserts at end-of-file', async () => {
    await setup();
    const result = await insert({
      file: filePath,
      position: 'end-of-file',
      body: 'export const LAST = true;',
    });
    expect(result.ok).toBe(true);
    const content = await readFile(filePath, 'utf8');
    expect(content.trimEnd().endsWith('export const LAST = true;')).toBe(true);
  });

  test('inserts after-imports', async () => {
    await setup();
    const result = await insert({
      file: filePath,
      position: 'after-imports',
      body: 'const CONFIG = {};',
    });
    expect(result.ok).toBe(true);
    const content = await readFile(filePath, 'utf8');
    const importIdx = content.indexOf("from 'node:fs/promises'");
    const configIdx = content.indexOf('const CONFIG');
    const greetIdx = content.indexOf('function greet');
    expect(configIdx).toBeGreaterThan(importIdx);
    expect(configIdx).toBeLessThan(greetIdx);
  });

  test('inserts at start-of-file', async () => {
    await setup();
    const result = await insert({
      file: filePath,
      position: 'start-of-file',
      body: '// header comment',
    });
    expect(result.ok).toBe(true);
    const content = await readFile(filePath, 'utf8');
    expect(content.startsWith('// header comment')).toBe(true);
  });

  test('validates anchor hash when provided', async () => {
    await setup();
    const result = await insert({
      file: filePath,
      position: 'after:greet',
      anchor_hash: 'bad0',
      body: 'export function wave(): string { return "wave"; }',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('STALE_READ');
    }
  });

  test('dry-run returns result without writing', async () => {
    await setup();
    const result = await insert({
      file: filePath,
      position: 'end-of-file',
      body: 'export const DRY = true;',
      dryRun: true,
    });
    expect(result.ok).toBe(true);
    const content = await readFile(filePath, 'utf8');
    expect(content).not.toContain('DRY');
  });

  test('injects imports alongside body', async () => {
    await setup();
    const result = await insert({
      file: filePath,
      position: 'after:greet',
      imports: ["{ writeFile } from 'node:fs/promises'"],
      body: 'export function save(): void {\n  writeFile("out", "data");\n}',
    });
    expect(result.ok).toBe(true);
    const content = await readFile(filePath, 'utf8');
    expect(content).toContain('writeFile');
    expect(content).toContain('function save');
  });
});
