import { afterEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rename } from '../../../src/core/rename.js';
import { locateSymbol } from '../../../src/parser/patch-engine.js';

describe('rename', () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });

  test('renames a symbol in its definition file', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ctx-rename-'));
    const filePath = join(tempDir, 'main.ts');
    const content = [
      'export function greet(name: string): string {',
      '  return `Hello, ${name}!`;',
      '}',
      '',
      'const msg = greet("world");',
      '',
    ].join('\n');
    await writeFile(filePath, content, 'utf8');

    // Get the correct hash from the engine
    const loc = await locateSymbol(content, 'greet', { language: 'typescript' });

    const result = await rename({
      file: filePath,
      symbol: 'greet',
      hash: loc!.hash,
      to: 'sayHello',
      scope: join(tempDir, '**/*.ts'),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.referencesUpdated).toBeGreaterThan(0);
    }
    const updated = await readFile(filePath, 'utf8');
    expect(updated).toContain('sayHello');
    expect(updated).not.toMatch(/\bgreet\b/);
  });

  test('renames across multiple files', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ctx-rename-'));
    await mkdir(join(tempDir, 'src'), { recursive: true });
    const defFile = join(tempDir, 'src', 'utils.ts');
    const useFile = join(tempDir, 'src', 'app.ts');

    const defContent = [
      'export function greet(name: string): string {',
      '  return `Hello, ${name}!`;',
      '}',
      '',
    ].join('\n');
    await writeFile(defFile, defContent, 'utf8');

    await writeFile(
      useFile,
      ["import { greet } from './utils.js';", '', 'console.log(greet("world"));', ''].join('\n'),
      'utf8',
    );

    const loc = await locateSymbol(defContent, 'greet', { language: 'typescript' });

    const result = await rename({
      file: defFile,
      symbol: 'greet',
      hash: loc!.hash,
      to: 'sayHello',
      scope: join(tempDir, 'src', '**/*.ts'),
    });

    expect(result.ok).toBe(true);
    const defUpdated = await readFile(defFile, 'utf8');
    const useUpdated = await readFile(useFile, 'utf8');
    expect(defUpdated).toContain('sayHello');
    expect(useUpdated).toContain('sayHello');
    expect(useUpdated).not.toMatch(/\bgreet\b/);
  });

  test('returns STALE_READ on hash mismatch', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ctx-rename-'));
    const filePath = join(tempDir, 'main.ts');
    await writeFile(filePath, 'export function greet() { return "hi"; }\n', 'utf8');

    const result = await rename({
      file: filePath,
      symbol: 'greet',
      hash: 'dead',
      to: 'sayHello',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('STALE_READ');
    }
  });

  test('dry-run returns summary without writing', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ctx-rename-'));
    const filePath = join(tempDir, 'main.ts');
    const content = 'export function greet() { return "hi"; }\nconst x = greet();\n';
    await writeFile(filePath, content, 'utf8');
    const loc = await locateSymbol(content, 'greet', { language: 'typescript' });

    const result = await rename({
      file: filePath,
      symbol: 'greet',
      hash: loc!.hash,
      to: 'sayHello',
      dryRun: true,
    });

    expect(result.ok).toBe(true);
    const unchanged = await readFile(filePath, 'utf8');
    expect(unchanged).toContain('greet');
    expect(unchanged).not.toContain('sayHello');
  });
});
