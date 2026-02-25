import { describe, expect, test } from 'bun:test';
import { compactUnifiedDiff } from '../../../src/utils/diff.js';

const SAMPLE_DIFF = [
  'diff --git a/src/app.ts b/src/app.ts',
  'index 1111111..2222222 100644',
  '--- a/src/app.ts',
  '+++ b/src/app.ts',
  '@@ -1,5 +1,5 @@ function run() {',
  ' const a = 1;',
  '-const oldName = true;',
  '+const newName = true;',
  ' return a;',
  '}',
].join('\n');

describe('compactUnifiedDiff', () => {
  test('compacts headers and reduces context by default', () => {
    const output = compactUnifiedDiff(SAMPLE_DIFF);

    expect(output).toContain('=== src/app.ts');
    expect(output).not.toContain('diff --git');
    expect(output).not.toContain('index 1111111');
    expect(output).toContain('@@ -1,5 +1,5 @@ function run() {');
    expect(output).toContain(' const a = 1;');
    expect(output).toContain(' return a;');
  });

  test('changesOnly emits path and changed lines', () => {
    const output = compactUnifiedDiff(SAMPLE_DIFF, { changesOnly: true });

    expect(output).toContain('--- src/app.ts');
    expect(output).toContain('@@ function run() {');
    expect(output).toContain('-const oldName = true;');
    expect(output).toContain('+const newName = true;');
    expect(output).not.toContain(' const a = 1;');
  });

  test('context 0 strips all unchanged context lines', () => {
    const output = compactUnifiedDiff(SAMPLE_DIFF, { context: 0, compactHeaders: false });

    expect(output).toContain('diff --git a/src/app.ts b/src/app.ts');
    expect(output).toContain('@@ -1,5 +1,5 @@ function run() {');
    expect(output).toContain('-const oldName = true;');
    expect(output).toContain('+const newName = true;');
    expect(output).not.toContain(' const a = 1;');
    expect(output).not.toContain(' return a;');
  });
});
