import type { List, ListItem, Root } from 'mdast';
import { describe, expect, test } from 'vitest';
import { markdownToAst } from '../../../src/parser/markdown-to-ast.js';
import { transformLists } from '../../../src/stages/structural/lists.js';

describe('transformLists', () => {
  test('adds compact prefixes for ordered and unordered list items', () => {
    const tree = markdownToAst('- one\n  - two\n1. three');
    const result = transformLists(tree, {}) as Root;

    const firstList = result.children[0] as List;
    const nestedList = (firstList.children[0] as ListItem).children[1] as List;
    const nestedListItem = nestedList.children[0] as ListItem;
    const orderedList = result.children[1] as List;

    expect((firstList.children[0] as ListItem).data?.compactPrefix).toBe('-');
    expect(nestedListItem.data?.compactPrefix).toBe('..-');
    expect((orderedList.children[0] as ListItem).data?.compactPrefix).toBe('+');
  });
});
