import { describe, expect, test } from 'bun:test';
import {
  applyLineEdits,
  computeLineHashes,
  locateSymbol,
  locateSymbolByHash,
  replaceSymbolBody,
} from '../../../src/parser/patch-engine.js';

const SAMPLE = [
  "import { readFile } from 'node:fs/promises';",
  '',
  'export function greet(name: string): string {',
  '  return `Hello, ${name}!`;',
  '}',
  '',
  'export function farewell(name: string): string {',
  '  return `Goodbye, ${name}!`;',
  '}',
  '',
].join('\n');

describe('locateSymbol', () => {
  test('finds a symbol by name and returns its range + hash', async () => {
    const result = await locateSymbol(SAMPLE, 'greet', { language: 'typescript' });
    expect(result).toBeDefined();
    expect(result!.name).toBe('greet');
    expect(result!.startLine).toBe(3);
    expect(result!.endLine).toBe(5);
    expect(result!.hash).toMatch(/^[0-9a-f]{4}$/);
    expect(result!.startIndex).toBeGreaterThanOrEqual(0);
    expect(result!.endIndex).toBeGreaterThan(result!.startIndex);
  });

  test('returns undefined for non-existent symbol', async () => {
    const result = await locateSymbol(SAMPLE, 'notHere', { language: 'typescript' });
    expect(result).toBeUndefined();
  });

  test('returns multiple matches for ambiguous names', async () => {
    const ambiguous = [
      'class Foo {',
      '  run() { return 1; }',
      '}',
      'class Bar {',
      '  run() { return 2; }',
      '}',
    ].join('\n');
    const result = await locateSymbol(ambiguous, 'run', { language: 'typescript' });
    expect(result).toBeDefined();
    expect(result!.ambiguous).toBeDefined();
    expect(result!.ambiguous!.length).toBe(2);
  });
});

describe('locateSymbolByHash', () => {
  test('disambiguates by hash when multiple matches exist', async () => {
    const ambiguous = [
      'class Foo {',
      '  run() { return 1; }',
      '}',
      'class Bar {',
      '  run() { return 2; }',
      '}',
    ].join('\n');
    // First, find all matches to get the hashes
    const firstMatch = await locateSymbol(ambiguous, 'run', { language: 'typescript' });
    expect(firstMatch).toBeDefined();
    expect(firstMatch!.ambiguous).toBeDefined();

    // Use the hash of the second match to locate it specifically
    const secondHash = firstMatch!.ambiguous![1]!.hash;
    const result = await locateSymbolByHash(ambiguous, 'run', secondHash, {
      language: 'typescript',
    });
    expect(result).toBeDefined();
    expect(result!.hash).toBe(secondHash);
    expect(result!.ambiguous).toBeUndefined();
  });

  test('returns undefined when hash does not match any candidate', async () => {
    const result = await locateSymbolByHash(SAMPLE, 'greet', 'zzzz', {
      language: 'typescript',
    });
    expect(result).toBeUndefined();
  });
});

describe('replaceSymbolBody', () => {
  test('replaces a symbol and returns new source', async () => {
    const loc = await locateSymbol(SAMPLE, 'greet', { language: 'typescript' });
    const newBody = 'export function greet(name: string): string {\n  return `Hi, ${name}!`;\n}';
    const result = replaceSymbolBody(SAMPLE, loc!, newBody);
    expect(result).toContain('Hi, ${name}!');
    expect(result).toContain('Goodbye, ${name}!');
    expect(result).not.toContain('Hello, ${name}!');
  });

  test('preserves content before and after the symbol', async () => {
    const loc = await locateSymbol(SAMPLE, 'greet', { language: 'typescript' });
    const newBody = 'export function greet(name: string): string {\n  return `Hi, ${name}!`;\n}';
    const result = replaceSymbolBody(SAMPLE, loc!, newBody);
    // Import should still be there
    expect(result).toContain("import { readFile } from 'node:fs/promises';");
    // farewell function should still be there
    expect(result).toContain('export function farewell');
  });
});

describe('computeLineHashes', () => {
  test('returns 2-char hashes for each line', async () => {
    const loc = await locateSymbol(SAMPLE, 'greet', { language: 'typescript' });
    const body = SAMPLE.slice(loc!.startIndex, loc!.endIndex);
    const hashes = computeLineHashes(body);
    expect(hashes.length).toBeGreaterThan(0);
    for (const h of hashes) {
      expect(h.hash).toMatch(/^[0-9a-f]{2}$/);
      expect(h.line).toBeDefined();
    }
  });

  test('line numbers are 1-based', () => {
    const hashes = computeLineHashes('line1\nline2\nline3');
    expect(hashes[0]!.lineNumber).toBe(1);
    expect(hashes[1]!.lineNumber).toBe(2);
    expect(hashes[2]!.lineNumber).toBe(3);
  });
});

describe('applyLineEdits', () => {
  test('replaces a line by hash', async () => {
    const loc = await locateSymbol(SAMPLE, 'greet', { language: 'typescript' });
    const body = SAMPLE.slice(loc!.startIndex, loc!.endIndex);
    const hashes = computeLineHashes(body);
    const returnLineHash = hashes.find((h) => h.line.includes('return'))!;
    const result = applyLineEdits(body, [
      { hash: returnLineHash.hash, replace: '  return `Hey, ${name}!`;' },
    ]);
    expect(result).toContain('Hey, ${name}!');
    expect(result).not.toContain('Hello, ${name}!');
  });

  test('inserts a line after a matched hash', async () => {
    const loc = await locateSymbol(SAMPLE, 'greet', { language: 'typescript' });
    const body = SAMPLE.slice(loc!.startIndex, loc!.endIndex);
    const hashes = computeLineHashes(body);
    const returnLineHash = hashes.find((h) => h.line.includes('return'))!;
    const result = applyLineEdits(body, [
      { hash: returnLineHash.hash, after: '  console.log("greeted");' },
    ]);
    expect(result).toContain('console.log("greeted")');
  });

  test('inserts a line before a matched hash', async () => {
    const loc = await locateSymbol(SAMPLE, 'greet', { language: 'typescript' });
    const body = SAMPLE.slice(loc!.startIndex, loc!.endIndex);
    const hashes = computeLineHashes(body);
    const returnLineHash = hashes.find((h) => h.line.includes('return'))!;
    const result = applyLineEdits(body, [
      { hash: returnLineHash.hash, before: '  console.log("about to greet");' },
    ]);
    expect(result).toContain('console.log("about to greet")');
    // The before line should appear before the return line
    const beforeIdx = result.indexOf('about to greet');
    const returnIdx = result.indexOf('return');
    expect(beforeIdx).toBeLessThan(returnIdx);
  });

  test('deletes a line by hash', async () => {
    const loc = await locateSymbol(SAMPLE, 'greet', { language: 'typescript' });
    const body = SAMPLE.slice(loc!.startIndex, loc!.endIndex);
    const hashes = computeLineHashes(body);
    const returnLineHash = hashes.find((h) => h.line.includes('return'))!;
    const result = applyLineEdits(body, [{ hash: returnLineHash.hash, delete: true }]);
    expect(result).not.toContain('return');
  });

  test('rejects on hash mismatch', () => {
    expect(() => applyLineEdits('line1\nline2\n', [{ hash: 'zz', replace: 'new' }])).toThrow(
      /hash mismatch/i,
    );
  });
});
