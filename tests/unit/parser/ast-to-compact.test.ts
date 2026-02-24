import { describe, expect, test } from 'vitest';
import { astToCompact } from '../../../src/parser/ast-to-compact.js';
import { markdownToAst } from '../../../src/parser/markdown-to-ast.js';

describe('astToCompact', () => {
  test('serializes key markdown structures into compact syntax', () => {
    const markdown = '# Title\n\n- [ ] todo\n\n| A | B |\n| - | - |\n| 1 | 2 |\n';
    const ast = markdownToAst(markdown);
    const compact = astToCompact(ast);

    expect(compact).toContain('%compact.md:1');
    expect(compact).toContain(':1 Title');
    expect(compact).toContain('[] todo');
    expect(compact).toContain('|: A, B');
  });
});
