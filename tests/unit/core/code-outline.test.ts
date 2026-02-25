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
  "  return input.trim();",
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
});
