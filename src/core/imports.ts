import { relative, resolve } from 'node:path';
import fg from 'fast-glob';
import type { ImportEdge, ImportsOptions, ImportsResult } from '../types/imports.js';
import { extractOutgoingEdges } from '../utils/import-resolver.js';

export async function fileImports(options: ImportsOptions): Promise<ImportsResult> {
  const root = resolve(options.root ?? '.');
  const file = relative(root, resolve(options.file));
  const direction = options.direction ?? 'both';

  const outgoing = direction === 'incoming' ? [] : await extractOutgoingEdges(file, root);
  const incoming = direction === 'outgoing' ? [] : await findIncomingImports(file, root);

  const output = formatOutput(file, outgoing, incoming, direction);
  return { file, outgoing, incoming, output };
}

async function findIncomingImports(targetFile: string, root: string): Promise<string[]> {
  const allFiles = await fg('**/*.{ts,tsx,js,jsx}', {
    cwd: root,
    ignore: ['node_modules/**', 'dist/**', '.git/**'],
  });

  const incoming: string[] = [];
  await Promise.all(
    allFiles.map(async (f) => {
      if (f === targetFile) return;
      const edges = await extractOutgoingEdges(f, root);
      if (edges.some((e) => e.resolved === targetFile)) {
        incoming.push(f);
      }
    }),
  );

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
