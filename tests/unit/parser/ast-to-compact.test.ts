import { describe, expect, test } from 'bun:test';
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

  test('uses single newlines between unambiguous compact blocks', () => {
    const markdown = '# Title\n\n## Section\n\n---\n';
    const ast = markdownToAst(markdown);
    const compact = astToCompact(ast);

    expect(compact).toContain(':1 Title\n:2 Section\n~');
    expect(compact).not.toContain(':1 Title\n\n:2 Section');
    expect(compact).not.toContain(':2 Section\n\n~');
  });

  test('emits a single-backtick code fence close marker', () => {
    const markdown = '```ts\nconsole.log("x");\n```\n';
    const ast = markdownToAst(markdown);
    const compact = astToCompact(ast, { versionMarker: false });
    const lines = compact.split('\n');

    expect(lines.at(-1)).toBe('`');
    expect(lines.at(-1)).not.toBe('``');
  });
});
