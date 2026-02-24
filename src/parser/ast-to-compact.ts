import type { Content, List, ListItem, PhrasingContent, Root, Table, TableCell } from 'mdast';
import type { CompactOptions } from '../types/options.js';
import { csvRow } from '../utils/text.js';
import { astToMarkdown } from './ast-to-markdown.js';
import { VERSION_MARKER } from './constants.js';

interface Chunk {
  text: string;
  compactBlock: boolean;
}

interface DedupEntry {
  token: string;
  value: string;
}

type RootWithDedupData = Root & {
  data?: {
    compactDedupDictionary?: DedupEntry[];
  };
};

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

function joinChunks(chunks: readonly Chunk[]): string {
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

function readDedupEntries(tree: Root): DedupEntry[] {
  const entries = (tree as RootWithDedupData).data?.compactDedupDictionary ?? [];
  return entries.filter((entry) => entry.token && entry.value);
}

function attachDedupDictionary(compactBody: string, entries: readonly DedupEntry[]): string {
  if (entries.length === 0) {
    return compactBody;
  }

  const dictionaryLines = entries.map((entry) => `${entry.token}=${entry.value}`).join('\n');
  return compactBody ? `${dictionaryLines}\n§§\n${compactBody}` : `${dictionaryLines}\n§§`;
}

export function astToCompact(tree: Root, options: CompactOptions = {}): string {
  const delimiter = options.tableDelimiter ?? ',';
  const chunks: Chunk[] = [];

  for (const node of tree.children) {
    if (!options.keepComments && isCommentNode(node)) {
      continue;
    }

    if (node.type === 'heading') {
      const heading = stringifyInline(node.children as PhrasingContent[]);
      chunks.push({ text: `${'#'.repeat(node.depth)} ${heading}`.trimEnd(), compactBlock: true });
      continue;
    }

    if (node.type === 'list') {
      // Fall back to standard Markdown for lists containing complex items
      // (code blocks, blockquotes, etc.) that can't be flattened to a single line.
      if (listHasComplexContent(node as List)) {
        const serialized = stringifyNode(node).trim();
        if (serialized) {
          chunks.push({ text: serialized, compactBlock: false });
        }
        continue;
      }
      const lines = serializeList(node as List);
      if (lines.length > 0) {
        chunks.push({ text: lines.join('\n'), compactBlock: false });
      }
      continue;
    }

    if (node.type === 'table') {
      const lines = serializeTable(node as Table, delimiter);
      if (lines.length > 0) {
        chunks.push({ text: lines.join('\n'), compactBlock: true });
      }
      continue;
    }

    if (node.type === 'code') {
      const open = `\`\`\`${node.lang ?? ''}`;
      const body = node.value;
      chunks.push({ text: `${open}\n${body}\n\`\`\``, compactBlock: true });
      continue;
    }

    if (node.type === 'thematicBreak') {
      chunks.push({ text: '---', compactBlock: true });
      continue;
    }

    const serialized = stringifyNode(node).trim();
    if (serialized) {
      const escaped = serialized
        .split('\n')
        .map((l) => (/^:[1-6](\s|$)/.test(l) ? `\\${l}` : l))
        .join('\n');
      chunks.push({ text: escaped, compactBlock: false });
    }
  }

  const compactBody = attachDedupDictionary(
    joinChunks(chunks),
    options.dedup ? readDedupEntries(tree) : [],
  );
  if (options.versionMarker !== true) {
    return compactBody;
  }

  return compactBody ? `${VERSION_MARKER}\n\n${compactBody}` : VERSION_MARKER;
}
