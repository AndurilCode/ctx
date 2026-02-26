import type { Dirent } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import type { TreeEntry, TreeOptions } from '../types/tree.js';
import { mapLimit } from './async.js';
import type { TokenCounter } from './tokens.js';

const DEFAULT_IGNORE = new Set([
  'node_modules',
  '.git',
  'dist',
  'coverage',
  '.next',
  '.cache',
  '.claude',
]);
const DEFAULT_CONCURRENCY = 16;

export async function buildFileTree(
  options: TreeOptions,
): Promise<{ entries: TreeEntry[]; root: string }> {
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
      const children =
        depth > 0 ? await walkDir(fullPath, root, depth - 1, ignore, glob) : undefined;
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
  concurrency = DEFAULT_CONCURRENCY,
): Promise<void> {
  const files: TreeEntry[] = [];
  collectFiles(entries, files);

  await mapLimit(files, Math.max(1, concurrency), async (entry) => {
    try {
      const content = await readFile(join(root, entry.path), 'utf8');
      entry.tokens = counter.count(content);
      entry.bytes = Buffer.byteLength(content, 'utf8');
      entry.lines = content.split('\n').length;
    } catch {
      // Binary or unreadable file — skip
    }
    return undefined;
  });

  updateDirectoryTokens(entries);
}

function collectFiles(entries: TreeEntry[], files: TreeEntry[]): void {
  for (const entry of entries) {
    if (entry.isDirectory) {
      if (entry.children) collectFiles(entry.children, files);
      continue;
    }
    files.push(entry);
  }
}

function updateDirectoryTokens(entries: TreeEntry[]): number {
  let total = 0;
  for (const entry of entries) {
    if (entry.isDirectory) {
      const childTotal = entry.children ? updateDirectoryTokens(entry.children) : 0;
      entry.tokens = childTotal;
      total += childTotal;
    } else {
      total += entry.tokens ?? 0;
    }
  }
  return total;
}
