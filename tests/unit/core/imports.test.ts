import { describe, expect, test } from 'bun:test';
import { fileImports } from '../../../src/core/imports.js';

describe('fileImports', () => {
  test('returns outgoing imports for compact.ts', async () => {
    const result = await fileImports({ file: 'src/core/compact.ts', direction: 'outgoing' });
    expect(result.outgoing.length).toBeGreaterThan(0);
    expect(result.output).toContain('Imports (outgoing)');
  });

  test('returns empty incoming for a new file', async () => {
    const result = await fileImports({ file: 'src/types/diff.ts', direction: 'outgoing' });
    expect(result.incoming).toHaveLength(0);
  });

  test('finds incoming imports for index.ts', async () => {
    const result = await fileImports({ file: 'src/core/compact.ts', direction: 'incoming' });
    expect(result.incoming.length).toBeGreaterThan(0);
    // src/index.ts should import from compact.ts
    const importsFromIndex = result.incoming.some((f) => f.includes('index'));
    expect(importsFromIndex).toBe(true);
  });
});
