import { relative, resolve } from 'node:path';
import type { ImportEdge, ImportsOptions, ImportsResult } from '../types/imports.js';
import { mapLimit } from '../utils/async.js';
import { discoverFilesCached } from '../utils/discovery-cache.js';
import { extractOutgoingEdges } from '../utils/import-resolver.js';

const DEFAULT_CONCURRENCY = 16;
const DEFAULT_GLOB = '**/*.{ts,tsx,js,jsx}';
const DEFAULT_IGNORE = ['node_modules/**', 'dist/**', '.git/**'];

export async function fileImports(options: ImportsOptions): Promise<ImportsResult> {
  const root = resolve(options.root ?? '.');
  const file = relative(root, resolve(options.file));
  const direction = options.direction ?? 'both';
  const concurrency = Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY);

  const outgoing = direction === 'incoming' ? [] : await extractOutgoingEdges(file, root);
  const incoming =
    direction === 'outgoing' ? [] : await findIncomingImports(file, root, concurrency);

  const output = formatOutput(file, outgoing, incoming, direction);
  return { file, outgoing, incoming, output };
}

async function findIncomingImports(
  targetFile: string,
  root: string,
  concurrency: number,
): Promise<string[]> {
  const allFiles = await discoverFilesCached({
    root,
    globPattern: DEFAULT_GLOB,
    ignore: DEFAULT_IGNORE,
  });
  const incoming: string[] = [];
  await mapLimit(allFiles, concurrency, async (f) => {
    if (f === targetFile) return;
    const edges = await extractOutgoingEdges(f, root);
    if (edges.some((e) => e.resolved === targetFile)) {
      incoming.push(f);
    }
  });

  return incoming.sort();
}

function formatOutput(
  file: string,
  outgoing: ImportEdge[],
  incoming: string[],
  direction: string,
): string {
  const lines: string[] = [file, ''];

  if (direction !== 'incoming' && outgoing.length > 0) {
    lines.push('Imports (outgoing):');
    for (const edge of outgoing) {
      lines.push(`  ${edge.specifier} -> ${edge.resolved}`);
    }
    lines.push('');
  } else if (direction !== 'incoming') {
    lines.push('Imports (outgoing): none');
    lines.push('');
  }

  if (direction !== 'outgoing' && incoming.length > 0) {
    lines.push('Imported by (incoming):');
    for (const imp of incoming) {
      lines.push(`  ${imp}`);
    }
  } else if (direction !== 'outgoing') {
    lines.push('Imported by (incoming): none');
  }

  return lines.join('\n').trimEnd();
}
