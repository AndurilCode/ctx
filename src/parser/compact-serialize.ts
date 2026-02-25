import type { Content, List, ListItem, PhrasingContent, Root, Table, TableCell } from 'mdast';
import { csvRow } from '../utils/text.js';
import { astToMarkdown } from './ast-to-markdown.js';

export interface Chunk {
  text: string;
  compactBlock: boolean;
}

export function stringifyNode(node: Content): string {
  return astToMarkdown({
    type: 'root',
    children: [node],
  } as Root).trimEnd();
}

function listItemHasComplexChildren(item: ListItem): boolean {
  return item.children.some((child) => child.type !== 'paragraph' && child.type !== 'list');
}

export function listHasComplexContent(list: List): boolean {
  return list.children.some(
    (child) => child.type === 'listItem' && listItemHasComplexChildren(child as ListItem),
  );
}

export function stringifyInline(children: readonly PhrasingContent[]): string {
  const paragraph: Content = {
    type: 'paragraph',
    children: [...children],
  };

  return stringifyNode(paragraph).replace(/\n/g, ' ').trim();
}

function listItemText(item: ListItem): string {
  const contentParts: string[] = [];

  for (const child of item.children) {
    if (child.type === 'list') {
      continue;
    }

    const block = stringifyNode(child as Content).trim();
    if (block) {
      contentParts.push(block.replace(/\n+/g, ' '));
    }
  }

  return contentParts.join(' ').trim();
}

export function serializeList(list: List, depth = 0): string[] {
  const lines: string[] = [];

  for (let i = 0; i < list.children.length; i++) {
    const child = list.children[i];
    if (!child || child.type !== 'listItem') {
      continue;
    }

    // Blank line separator before non-first items of a loose (spread) list
    if (i > 0 && list.spread) {
      lines.push('');
    }

    const item = child as ListItem;
    const text = listItemText(item);

    let prefix = `${'..'.repeat(depth)}${list.ordered ? '+' : '-'}`;
    if (typeof item.checked === 'boolean') {
      prefix = `${'..'.repeat(depth)}[${item.checked ? 'x' : ''}]`;
    }

    lines.push(text ? `${prefix} ${text}` : prefix);

    for (const nested of item.children) {
      if (nested.type === 'list') {
        lines.push(...serializeList(nested, depth + 1));
      }
    }
  }

  return lines;
}

function tableCellText(cell: TableCell): string {
  const phrasing = cell.children as PhrasingContent[];
  return stringifyInline(phrasing);
}

export function serializeTable(table: Table, delimiter: string): string[] {
  const [head, ...rows] = table.children;
  if (!head) {
    return [];
  }

  const headerValues = head.children.map((cell) => tableCellText(cell as TableCell));
  const output = [`|: ${csvRow(headerValues, delimiter)}`];

  for (const row of rows) {
    const rowValues = row.children.map((cell) => tableCellText(cell as TableCell));
    output.push(`| ${csvRow(rowValues, delimiter)}`);
  }

  return output;
}

export function isCommentNode(node: Content): boolean {
  return node.type === 'html' && /^<!--[\s\S]*-->$/.test(node.value.trim());
}

export function joinChunks(chunks: readonly Chunk[]): string {
  if (chunks.length === 0) {
    return '';
  }

  let output = chunks[0]?.text ?? '';
  for (let i = 1; i < chunks.length; i += 1) {
    const previous = chunks[i - 1];
    const current = chunks[i];
    if (!previous || !current) {
      continue;
    }

    const separator = previous.compactBlock && current.compactBlock ? '\n' : '\n\n';
    output += `${separator}${current.text}`;
  }

  return output.trimEnd();
}
