import type { List, PhrasingContent, Root, Table } from 'mdast';
import type { DedupEntry, RootWithDedupData } from '../types/dedup.js';
import type { CompactOptions } from '../types/options.js';
import {
  type Chunk,
  isCommentNode,
  joinChunks,
  listHasComplexContent,
  serializeList,
  serializeTable,
  stringifyInline,
  stringifyNode,
} from './compact-serialize.js';
import { VERSION_MARKER } from './constants.js';

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
