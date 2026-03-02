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

async function hashOf(source: string, name: string): Promise<string> {
  const loc = await locateSymbol(source, name, { language: 'ts' });
  if (!loc) throw new Error(`Symbol "${name}" not found`);
  return loc.hash;
}

describe('patch — multi-symbol', () => {
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

  test('multi-symbol atomic patch', async () => {
    await setup();
    const greetHash = await hashOf(SAMPLE, 'greet');
    const farewellHash = await hashOf(SAMPLE, 'farewell');
    const result = await patch({
      file: filePath,
      patches: [
        {
          symbol: 'greet',
          hash: greetHash,
          body: 'function greet(): string { return "A"; }',
        },
        {
          symbol: 'farewell',
          hash: farewellHash,
          body: 'function farewell(): string { return "B"; }',
        },
      ],
    });
    expect(result.ok).toBe(true);
    const content = await readFile(filePath, 'utf8');
    expect(content).toContain('return "A"');
    expect(content).toContain('return "B"');
  });

  test('multi-symbol rejects entirely on any hash mismatch', async () => {
    await setup();
    const greetHash = await hashOf(SAMPLE, 'greet');
    const result = await patch({
      file: filePath,
      patches: [
        {
          symbol: 'greet',
          hash: greetHash,
          body: 'function greet(): string { return "A"; }',
        },
        {
          symbol: 'farewell',
          hash: 'bad0',
          body: 'function farewell(): string { return "B"; }',
        },
      ],
    });
    expect(result.ok).toBe(false);
    const content = await readFile(filePath, 'utf8');
    // File should be unchanged — atomic rejection
    expect(content).toContain('Hello, ${name}!');
  });
});
