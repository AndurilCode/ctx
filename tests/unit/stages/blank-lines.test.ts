import { describe, expect, test } from 'bun:test';
import type { Paragraph, Root, Text } from 'mdast';
import { collapseBlankLinesStage } from '../../../src/stages/whitespace/blank-lines.js';

describe('collapseBlankLinesStage', () => {
  test('collapses excessive blank lines in text nodes', () => {
    const tree: Root = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: 'a\n\n\n\nb' }],
        },
      ],
    };

    const result = collapseBlankLinesStage(tree, {});
    const paragraph = result.children[0] as Paragraph;
    const text = paragraph.children[0] as Text;
    expect(text.value).toBe('a\n\nb');
  });
});
