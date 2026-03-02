import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { patch } from '../../../src/core/patch.js';
import { locateSymbol } from '../../../src/parser/patch-engine.js';
import { shortHash } from '../../../src/utils/hash.js';

async function hashOf(source: string, name: string): Promise<string> {
  const loc = await locateSymbol(source, name, { language: 'ts' });
  if (!loc) throw new Error(`Symbol "${name}" not found`);
  return loc.hash;
}

describe('patch — imports and line edits', () => {
  let tempDir: string;
  let filePath: string;

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });

  async function setup(content: string) {
    tempDir = await mkdtemp(join(tmpdir(), 'ctx-patch-'));
    filePath = join(tempDir, 'sample.ts');
    await writeFile(filePath, content, 'utf8');
    return filePath;
  }

  test('import injection adds new imports after last import', async () => {
    const src = [
      "import { foo } from './foo';",
      '',
      'export function bar() { return foo(); }',
      '',
    ].join('\n');
    await setup(src);
    const barHash = await hashOf(src, 'bar');
    const result = await patch({
      file: filePath,
      symbol: 'bar',
      hash: barHash,
      body: 'function bar() { return foo() + baz(); }',
      imports: ["import { baz } from './baz';"],
    });
    expect(result.ok).toBe(true);
    const content = await readFile(filePath, 'utf8');
    expect(content).toContain("import { baz } from './baz';");
    expect(content).toContain('foo() + baz()');
  });

  test('import injection deduplicates existing imports', async () => {
    const src = [
      "import { foo } from './foo';",
      '',
      'export function bar() { return foo(); }',
      '',
    ].join('\n');
    await setup(src);
    const barHash = await hashOf(src, 'bar');
    const result = await patch({
      file: filePath,
      symbol: 'bar',
      hash: barHash,
      body: 'function bar() { return foo(); }',
      imports: ["import { foo } from './foo';"],
    });
    expect(result.ok).toBe(true);
    const content = await readFile(filePath, 'utf8');
    const importCount = content.split("import { foo } from './foo';").length - 1;
    expect(importCount).toBe(1);
  });

  test('hashline fallback: applies line edits directly to full file', async () => {
    const src = ['const x = 1;', 'const y = 2;', 'const z = 3;', ''].join('\n');
    await setup(src);
    const yLineHash = shortHash('const y = 2;', 2);
    const result = await patch({
      file: filePath,
      lines: [{ hash: yLineHash, replace: 'const y = 42;' }],
    });
    expect(result.ok).toBe(true);
    const content = await readFile(filePath, 'utf8');
    expect(content).toContain('const y = 42;');
    expect(content).toContain('const x = 1;');
    expect(content).toContain('const z = 3;');
  });
});
