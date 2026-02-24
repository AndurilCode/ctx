import type { Content, List, ListItem, PhrasingContent, Root, Table, TableCell } from 'mdast';
import type { CompactOptions } from '../types/options.js';
import { csvRow } from '../utils/text.js';
import { astToMarkdown } from './ast-to-markdown.js';

const VERSION_MARKER = '%compact.md:1';

function stringifyNode(node: Content): string {
  return astToMarkdown({
    type: 'root',
    children: [node],
  } as Root).trimEnd();
}

function stringifyInline(children: readonly PhrasingContent[]): string {
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

function serializeList(list: List, depth = 0): string[] {
  const lines: string[] = [];

  for (const child of list.children) {
    if (child.type !== 'listItem') {
      continue;
    }

    const item = child as ListItem;
    const text = listItemText(item);

    let prefix = list.ordered ? '+' : `${'..'.repeat(depth)}-`;
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

function serializeTable(table: Table, delimiter: string): string[] {
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

function isCommentNode(node: Content): boolean {
  return node.type === 'html' && /^<!--[\s\S]*-->$/.test(node.value.trim());
}

export function astToCompact(tree: Root, options: CompactOptions = {}): string {
  const delimiter = options.tableDelimiter ?? ',';
  const chunks: string[] = [];

  for (const node of tree.children) {
    if (!options.keepComments && isCommentNode(node)) {
      continue;
    }

    if (node.type === 'heading') {
      const heading = stringifyInline(node.children as PhrasingContent[]);
      chunks.push(`:${node.depth} ${heading}`.trimEnd());
      continue;
    }

    if (node.type === 'list') {
      const lines = serializeList(node as List);
      if (lines.length > 0) {
        chunks.push(lines.join('\n'));
      }
      continue;
    }

    if (node.type === 'table') {
      const lines = serializeTable(node as Table, delimiter);
      if (lines.length > 0) {
        chunks.push(lines.join('\n'));
      }
      continue;
    }

    if (node.type === 'code') {
      const open = `\`${node.lang ?? ''}`;
      const body = node.value;
      chunks.push(`${open}\n${body}\n\``);
      continue;
    }

    if (node.type === 'thematicBreak') {
      chunks.push('~');
      continue;
    }

    const serialized = stringifyNode(node).trim();
    if (serialized) {
      chunks.push(serialized);
    }
  }

  const compactBody = chunks.join('\n\n').trimEnd();
  if (options.versionMarker === false) {
    return compactBody;
  }

  return compactBody ? `${VERSION_MARKER}\n\n${compactBody}` : VERSION_MARKER;
}
