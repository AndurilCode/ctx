import { describe, expect, test } from 'bun:test';
import { markdownToAst } from '../../../src/parser/markdown-to-ast.js';
import { transformHeadings } from '../../../src/stages/structural/headings.js';

describe('transformHeadings', () => {
  test('adds compact heading metadata', () => {
    const tree = markdownToAst('# Title');
    const result = transformHeadings(tree, {});
    const heading = result.children[0];

    expect(heading?.type).toBe('heading');
    if (heading?.type !== 'heading') {
      throw new Error('Expected a heading node.');
    }

    expect(heading.data?.compactHeading).toBe(':1');
  });
});
