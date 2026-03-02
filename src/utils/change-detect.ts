import { spawnSync } from 'node:child_process';
import { relative, resolve } from 'node:path';
import type { ChangedSymbol } from '../types/change-verify.js';
import type { OutlineNode } from '../types/outline.js';
import { readFileText } from './file-reader.js';
import { codeOutline } from '../core/code-outline.js';

function flattenNodes(nodes: OutlineNode[]): OutlineNode[] {
  const out: OutlineNode[] = [];
  const stack = [...nodes];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;
    out.push(node);
    if (node.children) stack.push(...node.children);
  }
  return out;
}

export function detectWorkingTreeChangedFiles(root = '.'): string[] {
  const absRoot = resolve(root);
  const outputs = [
    spawnSync('git', ['diff', '--name-only'], { cwd: absRoot, encoding: 'utf8' }),
    spawnSync('git', ['diff', '--name-only', '--cached'], { cwd: absRoot, encoding: 'utf8' }),
  ];
  const names = new Set<string>();
  for (const result of outputs) {
    if (result.status !== 0 || !result.stdout) continue;
    for (const line of result.stdout.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      names.add(relative(resolve('.'), resolve(absRoot, trimmed)));
    }
  }
  return [...names].sort();
}

export async function detectChangedSymbols(options: {
  files: string[];
  root?: string;
  symbol?: string;
  since?: string;
}): Promise<ChangedSymbol[]> {
  const root = resolve(options.root ?? '.');
  const changed: ChangedSymbol[] = [];

  for (const file of options.files) {
    const absFile = resolve(root, file);
    let content: string;
    try {
      content = await readFileText(absFile);
    } catch {
      continue;
    }

    let outlined;
    try {
      outlined = await codeOutline(content, { filePath: absFile });
    } catch {
      continue;
    }
    const nodes = flattenNodes(outlined.nodes).filter((node) =>
      options.symbol ? node.name === options.symbol : node.kind !== 'import',
    );

    for (const node of nodes.slice(0, options.symbol ? 20 : 8)) {
      const before = options.since && options.symbol === node.name ? options.since : undefined;
      if (before && node.hash === before) continue;
      changed.push({
        file: relative(resolve('.'), absFile),
        symbol: node.name,
        hashBefore: before,
        hashAfter: node.hash,
      });
    }
  }

  return changed;
}
