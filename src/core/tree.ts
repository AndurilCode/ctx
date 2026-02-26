import type { TreeEntry, TreeOptions, TreeResult } from '../types/tree.js';
import { buildFileTree, enrichWithTokenCounts } from '../utils/file-tree.js';
import { createTokenCounter } from '../utils/tokens.js';

export async function tree(options: TreeOptions = {}): Promise<TreeResult> {
  const { entries, root } = await buildFileTree(options);
  const counter = await createTokenCounter();
  await enrichWithTokenCounts(entries, root, counter, options.concurrency);

  let totalTokens = 0;
  let totalFiles = 0;
  const lines: string[] = [];

  formatEntries(entries, lines, 0, (t, f) => {
    totalTokens += t;
    totalFiles += f;
  });

  return { root, entries, totalTokens, totalFiles, output: lines.join('\n') };
}

function formatEntries(
  entries: TreeEntry[],
  lines: string[],
  indent: number,
  accumulate: (tokens: number, files: number) => void,
): void {
  const prefix = '  '.repeat(indent);
  for (const entry of entries) {
    if (entry.isDirectory) {
      const t = entry.tokens ?? 0;
      lines.push(`${prefix}${entry.name}/ (${t}t)`);
      if (entry.children) {
        formatEntries(entry.children, lines, indent + 1, accumulate);
      }
    } else {
      const t = entry.tokens ?? 0;
      const l = entry.lines ?? 0;
      lines.push(`${prefix}${entry.name}  ${t}t  ${l} lines`);
      accumulate(t, 1);
    }
  }
}
