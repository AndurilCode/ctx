import type { Content, List, ListItem, PhrasingContent, Root, Table, TableCell } from 'mdast';
import type { CompactOptions } from '../types/options.js';
import { csvRow } from '../utils/text.js';
import { astToMarkdown } from './ast-to-markdown.js';
import { VERSION_MARKER } from './constants.js';

function stringifyNode(node: Content): string {
  return astToMarkdown({
    type: 'root',
    children: [node],
  } as Root).trimEnd();
}

function listItemHasComplexChildren(item: ListItem): boolean {
  return item.children.some((child) => child.type !== 'paragraph' && child.type !== 'list');
}

function listHasComplexContent(list: List): boolean {
  return list.children.some(
    (child) => child.type === 'listItem' && listItemHasComplexChildren(child as ListItem),
  );
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
      // Fall back to standard Markdown for lists containing complex items
      // (code blocks, blockquotes, etc.) that can't be flattened to a single line.
      if (listHasComplexContent(node as List)) {
        const serialized = stringifyNode(node).trim();
        if (serialized) {
          chunks.push(serialized);
        }
        continue;
      }
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
      chunks.push(`${open}\n${body}\n\`\``);
      continue;
    }

    if (node.type === 'thematicBreak') {
      chunks.push('~');
      continue;
    }

    const serialized = stringifyNode(node).trim();
    if (serialized) {
      const escaped = serialized
        .split('\n')
        .map((l) => (/^:[1-6](\s|$)/.test(l) ? `\\${l}` : l))
        .join('\n');
      chunks.push(escaped);
    }
  }

  const compactBody = chunks.join('\n\n').trimEnd();
  if (options.versionMarker === false) {
    return compactBody;
  }

  return compactBody ? `${VERSION_MARKER}\n\n${compactBody}` : VERSION_MARKER;
}
