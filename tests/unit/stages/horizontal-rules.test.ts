import { describe, expect, test } from 'bun:test';
import { markdownToAst } from '../../../src/parser/markdown-to-ast.js';
import { transformHorizontalRules } from '../../../src/stages/structural/horizontal-rules.js';

describe('transformHorizontalRules', () => {
  test('marks thematic break nodes as compact tilde', () => {
    const tree = markdownToAst('---');
    const result = transformHorizontalRules(tree, {});
    const hr = result.children[0];

    expect(hr?.type).toBe('thematicBreak');
    if (hr?.type !== 'thematicBreak') {
      throw new Error('Expected a thematic break node.');
    }

    expect(hr.data?.compactThematicBreak).toBe('~');
  });
});
