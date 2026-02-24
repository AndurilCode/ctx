import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { compact } from '../../src/core/compact.js';
import { verify } from '../../src/core/verify.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

describe('round-trip integration', () => {
  test('verifies fixture document round-trip', async () => {
    const markdown = await readFile(resolve(root, 'fixtures/documents/sample.md'), 'utf8');
    expect(verify(markdown)).toBe(true);
  });

  test('verifies edge-case fixture round-trip (commas in table cells, code with heading-like text)', async () => {
    const markdown = await readFile(
      resolve(root, 'fixtures/edge-cases/code-and-tables.md'),
      'utf8',
    );
    expect(verify(markdown)).toBe(true);
  });

  test('matches expected compact fixture shape', async () => {
    const markdown = await readFile(resolve(root, 'fixtures/documents/sample.md'), 'utf8');
    const expected = await readFile(resolve(root, 'fixtures/expected/sample.cmd'), 'utf8');
    const output = compact(markdown);
    const compactText = output.output;

    expect(compactText.trim()).toBe(expected.trim());
  });
});
