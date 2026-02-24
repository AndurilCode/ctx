import { describe, expect, test } from 'vitest';
import { astToMarkdown } from '../../../src/parser/ast-to-markdown.js';
import { compactToAst } from '../../../src/parser/compact-to-ast.js';

describe('compactToAst', () => {
  test('parses compact syntax back into markdown AST', () => {
    const compact = `%compact.md:1

:1 Title

[] todo

|: A, B
| 1, 2

~
`;

    const ast = compactToAst(compact);
    const markdown = astToMarkdown(ast);

    expect(markdown).toContain('# Title');
    expect(markdown).toContain('- [ ] todo');
    expect(markdown).toContain('| A | B |');
    expect(markdown).toContain('---');
  });
});
