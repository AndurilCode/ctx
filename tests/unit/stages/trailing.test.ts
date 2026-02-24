import type { Paragraph, Root, Text } from 'mdast';
import { describe, expect, test } from 'vitest';
import { stripTrailingStage } from '../../../src/stages/whitespace/trailing.js';

describe('stripTrailingStage', () => {
  test('removes trailing whitespace from text nodes', () => {
    const tree: Root = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: 'value   ' }],
        },
      ],
    };

    const result = stripTrailingStage(tree, {});
    const paragraph = result.children[0] as Paragraph;
    const text = paragraph.children[0] as Text;
    expect(text.value).toBe('value');
  });
});
