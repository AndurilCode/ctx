import { describe, expect, test } from 'bun:test';
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

  test('parses compact text with single-newline boundaries between blocks', () => {
    const compact = `%compact.md:1

:1 Title
:2 Section
[] todo
~
`;

    const ast = compactToAst(compact);
    const markdown = astToMarkdown(ast);

    expect(markdown).toContain('# Title');
    expect(markdown).toContain('## Section');
    expect(markdown).toContain('- [ ] todo');
    expect(markdown).toContain('---');
  });

  test('parses single-backtick code fence close marker', () => {
    const compact = `%compact.md:1

\`ts
console.log("x");
\`
`;

    const ast = compactToAst(compact);
    const markdown = astToMarkdown(ast);

    expect(markdown).toContain('```ts');
    expect(markdown).toContain('console.log("x");');
    expect(markdown).toContain('```');
  });

  test('parses markdown-style headings, hr, and code fences unchanged', () => {
    const compact = `# Title

## Section

\`\`\`ts
console.log("x");
\`\`\`

---
`;

    const ast = compactToAst(compact);
    const markdown = astToMarkdown(ast);

    expect(markdown).toContain('# Title');
    expect(markdown).toContain('## Section');
    expect(markdown).toContain('```ts');
    expect(markdown).toContain('---');
  });
});
