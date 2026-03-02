import { afterEach, describe, expect, test } from 'bun:test';
import { readFile, rm, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { atomicWrite } from '../../../src/utils/atomic-write.js';

describe('atomicWrite', () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });

  test('writes content to a new file', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ctx-test-'));
    const target = join(tempDir, 'output.ts');
    await atomicWrite(target, 'hello world');
    const content = await readFile(target, 'utf8');
    expect(content).toBe('hello world');
  });

  test('overwrites existing file atomically', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ctx-test-'));
    const target = join(tempDir, 'output.ts');
    await atomicWrite(target, 'first');
    await atomicWrite(target, 'second');
    const content = await readFile(target, 'utf8');
    expect(content).toBe('second');
  });

  test('no temp files left behind on success', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ctx-test-'));
    const target = join(tempDir, 'output.ts');
    await atomicWrite(target, 'content');
    const { readdir } = await import('node:fs/promises');
    const files = await readdir(tempDir);
    expect(files).toEqual(['output.ts']);
  });
});
