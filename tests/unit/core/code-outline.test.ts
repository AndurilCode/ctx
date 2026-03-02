import { describe, expect, test } from 'bun:test';
import { codeOutline } from '../../../src/core/code-outline.js';

const SAMPLE_TS = [
  "import { readFile } from 'node:fs/promises';",
  '',
  'interface Config {',
  '  enabled: boolean;',
  '}',
  '',
  'export function runTask(input: string): string {',
  '  return input.trim();',
  '}',
  '',
  'class Worker {',
  '  process(value: string): string {',
  '    return value;',
  '  }',
  '}',
  '',
].join('\n');

describe('codeOutline', () => {
  test('returns a structural outline for TypeScript input', async () => {
    const result = await codeOutline(SAMPLE_TS, { language: 'ts' });

    expect(result.language).toBe('TypeScript');
    expect(result.totalLines).toBe(16);
    expect(result.output).toContain('Functions:');
    expect(result.output).toContain('runTask');
    expect(result.output).toContain('Interfaces:');
    expect(result.output).toContain('Config');
    expect(result.output).toContain('Classes:');
    expect(result.output).toContain('Worker');
  });

  test('respects depth option by trimming nested methods', async () => {
    const result = await codeOutline(SAMPLE_TS, { language: 'typescript', depth: 1 });
    expect(result.output).toContain('Worker');
    expect(result.output).not.toContain('process(value: string)');
  });

  test('outline nodes include content hashes', async () => {
    const result = await codeOutline(SAMPLE_TS, { language: 'ts' });
    const runTask = result.nodes.find((n) => n.name === 'runTask');
    expect(runTask).toBeDefined();
    expect(runTask!.hash).toBeDefined();
    expect(runTask!.hash).toMatch(/^[0-9a-f]{4}$/);
  });

  test('hash changes when symbol body changes', async () => {
    const result1 = await codeOutline(SAMPLE_TS, { language: 'ts' });
    const modified = SAMPLE_TS.replace('return input.trim();', 'return input.toUpperCase();');
    const result2 = await codeOutline(modified, { language: 'ts' });
    const hash1 = result1.nodes.find((n) => n.name === 'runTask')!.hash;
    const hash2 = result2.nodes.find((n) => n.name === 'runTask')!.hash;
    expect(hash1).not.toBe(hash2);
  });

  test('formatted output includes hash', async () => {
    const result = await codeOutline(SAMPLE_TS, { language: 'ts' });
    expect(result.output).toMatch(/runTask.*hash:[0-9a-f]{4}/);
  });
});
