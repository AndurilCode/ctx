import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import type { Dirent } from 'node:fs';
import type { TreeEntry, TreeOptions } from '../types/tree.js';
import type { TokenCounter } from './tokens.js';

const DEFAULT_IGNORE = new Set(['node_modules', '.git', 'dist', 'coverage', '.next', '.cache', '.claude']);

export async function buildFileTree(options: TreeOptions): Promise<{ entries: TreeEntry[]; root: string }> {
  const root = resolve(options.path ?? '.');
  const depth = options.depth ?? 3;
  const ignoreSet = new Set([...DEFAULT_IGNORE, ...(options.ignore ?? [])]);
  const entries = await walkDir(root, root, depth, ignoreSet, options.glob);
  return { entries, root };
}

async function walkDir(
  dir: string,
  root: string,
  depth: number,
  ignore: Set<string>,
  glob?: string,
): Promise<TreeEntry[]> {
  let dirEntries: Dirent<string>[];
  try {
    dirEntries = await readdir(dir, { withFileTypes: true, encoding: 'utf8' });
  } catch {
    return [];
  }

  const results: TreeEntry[] = [];

  for (const entry of dirEntries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (ignore.has(entry.name) || entry.name.startsWith('.')) continue;

    const fullPath = join(dir, entry.name);
    const relPath = relative(root, fullPath);

    if (entry.isDirectory()) {
      const children = depth > 0 ? await walkDir(fullPath, root, depth - 1, ignore, glob) : undefined;
      results.push({ path: relPath, name: entry.name, isDirectory: true, children });
    } else {
      if (glob && !matchesGlob(entry.name, glob)) continue;
      results.push({ path: relPath, name: entry.name, isDirectory: false });
    }
  }

  return results;
}

function matchesGlob(name: string, glob: string): boolean {
  const extMatch = glob.match(/\*\.(\w+)$/);
  if (extMatch) return name.endsWith(`.${extMatch[1]}`);
  return true;
}

export async function enrichWithTokenCounts(
  entries: TreeEntry[],
  root: string,
  counter: TokenCounter,
): Promise<void> {
  for (const entry of entries) {
    if (entry.isDirectory && entry.children) {
      await enrichWithTokenCounts(entry.children, root, counter);
      entry.tokens = entry.children.reduce((sum, c) => sum + (c.tokens ?? 0), 0);
    } else if (!entry.isDirectory) {
      try {
        const content = await readFile(join(root, entry.path), 'utf8');
        entry.tokens = counter.count(content);
        entry.bytes = Buffer.byteLength(content, 'utf8');
        entry.lines = content.split('\n').length;
      } catch {
        // Binary or unreadable file — skip
      }
    }
  }
}
