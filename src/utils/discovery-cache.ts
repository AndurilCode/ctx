import fg from 'fast-glob';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const DEFAULT_CACHE_PATH = join(tmpdir(), 'compact-md', 'discovery-cache.json');

interface DiscoveryCacheEntry {
  files: string[];
  dirMtimeNs: Record<string, string>;
}

type DiscoveryCacheStore = Record<string, DiscoveryCacheEntry>;

let activeCachePath = DEFAULT_CACHE_PATH;
let cache: DiscoveryCacheStore | null = null;
let stats = { hits: 0, misses: 0 };

function load(): DiscoveryCacheStore {
  if (cache !== null) return cache;
  try {
    cache = JSON.parse(readFileSync(activeCachePath, 'utf8')) as DiscoveryCacheStore;
  } catch {
    cache = {};
  }
  return cache;
}

function flush(): void {
  mkdirSync(dirname(activeCachePath), { recursive: true });
  writeFileSync(activeCachePath, JSON.stringify(load()), 'utf8');
}

function cacheKey(root: string, globPattern: string, ignore: string[]): string {
  return JSON.stringify({
    root: resolve(root),
    glob: globPattern,
    ignore: [...ignore].sort(),
  });
}

function collectTrackedDirs(root: string, relFiles: string[]): string[] {
  const absRoot = resolve(root);
  const dirs = new Set<string>([absRoot]);
  for (const relFile of relFiles) {
    let current = dirname(resolve(absRoot, relFile));
    while (current.startsWith(absRoot)) {
      dirs.add(current);
      if (current === absRoot) break;
      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  return [...dirs];
}

async function createDirMtimeMap(dirs: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const dir of dirs) {
    const dirStat = await stat(dir, { bigint: true });
    out[dir] = dirStat.mtimeNs.toString();
  }
  return out;
}

async function isFresh(entry: DiscoveryCacheEntry): Promise<boolean> {
  for (const [dir, mtimeNs] of Object.entries(entry.dirMtimeNs)) {
    try {
      const dirStat = await stat(dir, { bigint: true });
      if (dirStat.mtimeNs.toString() !== mtimeNs) return false;
    } catch {
      return false;
    }
  }
  return true;
}

export async function discoverFilesCached(options: {
  root: string;
  globPattern: string;
  ignore: string[];
}): Promise<string[]> {
  const root = resolve(options.root);
  const key = cacheKey(root, options.globPattern, options.ignore);
  const cached = load()[key];

  if (cached && (await isFresh(cached))) {
    stats.hits += 1;
    return cached.files;
  }

  stats.misses += 1;
  const files = await fg(options.globPattern, {
    cwd: root,
    ignore: options.ignore,
    onlyFiles: true,
  });
  const trackedDirs = collectTrackedDirs(root, files);
  load()[key] = {
    files,
    dirMtimeNs: await createDirMtimeMap(trackedDirs),
  };
  flush();
  return files;
}

/** Reset in-memory cache and optionally redirect to a different file. Tests only. */
export function _resetDiscoveryCacheForTesting(path?: string): void {
  cache = null;
  stats = { hits: 0, misses: 0 };
  activeCachePath = path ?? DEFAULT_CACHE_PATH;
}

/** Expose counters for cache hit/miss assertions in unit tests. */
export function _getDiscoveryCacheStatsForTesting(): { hits: number; misses: number } {
  return { ...stats };
}
