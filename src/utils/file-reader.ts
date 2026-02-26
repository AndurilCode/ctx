import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

interface FileCacheEntry {
  mtimeNs: bigint;
  size: bigint;
  content: string;
}

const fileTextCache = new Map<string, FileCacheEntry>();

export async function readFileText(path: string): Promise<string> {
  const absPath = resolve(path);
  const fileStat = await stat(absPath, { bigint: true });
  const cached = fileTextCache.get(absPath);

  if (cached && cached.mtimeNs === fileStat.mtimeNs && cached.size === fileStat.size) {
    return cached.content;
  }

  const content = await readFile(absPath, 'utf8');
  fileTextCache.set(absPath, {
    mtimeNs: fileStat.mtimeNs,
    size: fileStat.size,
    content,
  });
  return content;
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** Reset in-memory file cache. Tests only. */
export function _resetFileTextCacheForTesting(): void {
  fileTextCache.clear();
}
