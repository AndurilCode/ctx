import { describe, expect, test } from 'bun:test';
import { markdownToAst } from '../../../src/parser/markdown-to-ast.js';
import { transformCodeBlocks } from '../../../src/stages/structural/code-blocks.js';

describe('transformCodeBlocks', () => {
  test('marks code nodes for compact fence serialization', () => {
    const tree = markdownToAst('```ts\nconst x = 1;\n```');
    const result = transformCodeBlocks(tree, {});
    const code = result.children[0];

    expect(code?.type).toBe('code');
    if (code?.type !== 'code') {
      throw new Error('Expected a code node.');
    }

    expect(code.data?.compactCodeFence).toBe(true);
  });
});
