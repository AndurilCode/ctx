import { describe, expect, test } from 'vitest';
import { markdownToAst } from '../../../src/parser/markdown-to-ast.js';
import { transformTables } from '../../../src/stages/structural/tables.js';

describe('transformTables', () => {
  test('marks table nodes for compact serialization', () => {
    const tree = markdownToAst('| A |\n| - |\n| B |');
    const result = transformTables(tree, {});
    const table = result.children[0];

    expect(table?.type).toBe('table');
    if (table?.type !== 'table') {
      throw new Error('Expected a table node.');
    }

    expect(table.data?.compactTable).toBe(true);
  });
});
