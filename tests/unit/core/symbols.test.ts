import { describe, expect, test } from 'bun:test';
import { symbols } from '../../../src/core/symbols.js';

describe('symbols', () => {
  test('finds definition of TokenCountOptions', async () => {
    const result = await symbols({
      query: 'TokenCountOptions',
      path: 'src/types',
      glob: '**/*.ts',
    });
    expect(result.definitions.length).toBeGreaterThan(0);
    expect(result.definitions[0]?.name).toBe('TokenCountOptions');
    expect(result.definitions[0]?.file).toContain('token-count');
  });

  test('finds usages across the codebase', async () => {
    const result = await symbols({
      query: 'TokenCountOptions',
      path: 'src',
      glob: '**/*.ts',
    });
    // Should find the definition file + core file that uses it
    expect(result.usages.length).toBeGreaterThan(0);
  });

  test('returns formatted output', async () => {
    const result = await symbols({
      query: 'TokenCountOptions',
      path: 'src',
      glob: '**/*.ts',
    });
    expect(result.output).toContain('TokenCountOptions');
    expect(result.output).toContain('Defined in');
  });
});
