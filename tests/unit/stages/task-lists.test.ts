import { describe, expect, test } from 'bun:test';
import type { List, ListItem } from 'mdast';
import { markdownToAst } from '../../../src/parser/markdown-to-ast.js';
import { transformTaskLists } from '../../../src/stages/structural/task-lists.js';

describe('transformTaskLists', () => {
  test('marks checklist items for compact task syntax', () => {
    const tree = markdownToAst('- [ ] todo\n- [x] done');
    const result = transformTaskLists(tree, {});
    const list = result.children[0] as List;

    expect((list.children[0] as ListItem).data?.compactTask).toBe(true);
    expect((list.children[1] as ListItem).data?.compactTask).toBe(true);
  });
});
