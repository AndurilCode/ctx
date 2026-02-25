import { astToMarkdown } from '../parser/ast-to-markdown.js';
import { markdownToAst } from '../parser/markdown-to-ast.js';
import type { CompactOptions, ExpandOptions } from '../types/options.js';
import { compact } from './compact.js';
import { expand } from './expand.js';

function normalizeMarkdown(input: string): string {
  const ast = markdownToAst(input);
  return astToMarkdown(ast).trimEnd();
}

export function verify(
  markdown: string,
  compactOptions: CompactOptions = {},
  expandOptions: ExpandOptions = {},
): boolean {
  const compacted = compact(markdown, compactOptions);
  const restored = expand(compacted.output, expandOptions);
  return normalizeMarkdown(markdown) === normalizeMarkdown(restored);
}

export interface VerifyDiagnostics {
  valid: boolean;
  mismatch?: {
    line: number;
    expected: string;
    actual: string;
  };
}

export function verifyWithDiagnostics(
  markdown: string,
  compactOptions: CompactOptions = {},
  expandOptions: ExpandOptions = {},
): VerifyDiagnostics {
  const compacted = compact(markdown, compactOptions);
  const restored = expand(compacted.output, expandOptions);
  const expected = normalizeMarkdown(markdown);
  const actual = normalizeMarkdown(restored);

  if (expected === actual) return { valid: true };

  const expectedLines = expected.split('\n');
  const actualLines = actual.split('\n');
  const len = Math.max(expectedLines.length, actualLines.length);

  for (let i = 0; i < len; i++) {
    if (expectedLines[i] !== actualLines[i]) {
      return {
        valid: false,
        mismatch: {
          line: i + 1,
          expected: expectedLines[i] ?? '(end of file)',
          actual: actualLines[i] ?? '(end of file)',
        },
      };
    }
  }

  return { valid: false };
}
