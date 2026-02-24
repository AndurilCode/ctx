import type { Heading, Root } from 'mdast';
import { visit } from 'unist-util-visit';

export interface HeadingRange {
  depth: number;
  start: number;
  end: number;
  text: string;
}

export function headingText(heading: Heading): string {
  const chunks: string[] = [];

  visit(heading, (node) => {
    if (node.type === 'text' && 'value' in node && typeof node.value === 'string') {
      chunks.push(node.value);
      return;
    }

    if (node.type === 'inlineCode' && 'value' in node && typeof node.value === 'string') {
      chunks.push(node.value);
    }
  });

  return chunks.join(' ').trim();
}

export function buildHeadingRanges(tree: Root): HeadingRange[] {
  const headings = tree.children
    .map((node, index) => ({ node, index }))
    .filter((entry): entry is { node: Heading; index: number } => entry.node.type === 'heading');

  return headings.map((entry, index) => {
    const currentDepth = entry.node.depth;
    let end = tree.children.length;

    for (let offset = index + 1; offset < headings.length; offset += 1) {
      const next = headings[offset];
      if (next && next.node.depth <= currentDepth) {
        end = next.index;
        break;
      }
    }

    return {
      depth: currentDepth,
      start: entry.index,
      end,
      text: headingText(entry.node),
    };
  });
}
