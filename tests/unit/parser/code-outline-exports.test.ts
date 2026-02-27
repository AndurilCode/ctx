import { describe, expect, test } from 'bun:test';
import { codeOutline } from '../../../src/core/code-outline.js';

const BARREL_FILE = [
  "export { compact } from './core/compact.js';",
  "export { expand } from './core/expand.js';",
  "export type { CompactOptions } from './types/options.js';",
  "export { verify } from './core/verify.js';",
  '',
].join('\n');

const MIXED_FILE = [
  "import { readFile } from 'node:fs/promises';",
  '',
  "export { helper } from './utils.js';",
  '',
  'export function process(input: string): string {',
  '  return input.trim();',
  '}',
  '',
].join('\n');

const NAMED_EXPORT = ['const a = 1;', 'const b = 2;', 'export { a, b };', ''].join('\n');

describe('export-aware outline', () => {
  test('captures re-exports in barrel files', async () => {
    const result = await codeOutline(BARREL_FILE, { language: 'typescript' });

    expect(result.nodes.filter((n) => n.kind === 'export').length).toBe(4);
    expect(result.output).toContain('Exports:');
    expect(result.output).toContain('./core/compact.js');
    expect(result.output).toContain('./core/expand.js');
    expect(result.output).toContain('./types/options.js');
    expect(result.output).toContain('(4 exports)');
  });

  test('declaration exports are still captured as their declaration kind', async () => {
    const result = await codeOutline(MIXED_FILE, { language: 'typescript' });

    const exports = result.nodes.filter((n) => n.kind === 'export');
    const functions = result.nodes.filter((n) => n.kind === 'function');

    expect(exports.length).toBe(1);
    expect(exports[0]!.name).toBe('./utils.js');
    expect(functions.length).toBe(1);
    expect(functions[0]!.name).toBe('process');
    expect(result.output).toContain('Exports:');
    expect(result.output).toContain('Functions:');
  });

  test('captures plain named exports without source', async () => {
    const result = await codeOutline(NAMED_EXPORT, { language: 'typescript' });

    const exports = result.nodes.filter((n) => n.kind === 'export');
    expect(exports.length).toBe(1);
    expect(exports[0]!.kind).toBe('export');
  });
});
