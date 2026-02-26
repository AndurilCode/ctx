import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { open, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import fg from 'fast-glob';
import { mapLimit } from './async.js';

const DEFAULT_CACHE_PATH = join(tmpdir(), 'compact-md', 'discovery-cache.json');
const STAT_CONCURRENCY = 64;

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

async function flush(): Promise<void> {
  const flushed = await withCacheLock(activeCachePath, async () => {
    mkdirSync(dirname(activeCachePath), { recursive: true });
    const merged = { ...(await readDiskAsync()), ...load() };
    writeAtomically(activeCachePath, JSON.stringify(merged));
    cache = merged;
  });
  if (!flushed) return;
}

function cacheKey(root: string, globPattern: string, ignore: string[]): string {
  return JSON.stringify({
    root: resolve(root),
    glob: globPattern,
    ignore: [...ignore].sort(),
  });
}

async function readDiskAsync(): Promise<DiscoveryCacheStore> {
  try {
    return JSON.parse(await readFile(activeCachePath, 'utf8')) as DiscoveryCacheStore;
  } catch {
    return {};
  }
}

function writeAtomically(path: string, content: string): void {
  const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temp, content, 'utf8');
  renameSync(temp, path);
}

async function withCacheLock(path: string, task: () => Promise<void>): Promise<boolean> {
  const lockPath = `${path}.lock`;
  mkdirSync(dirname(lockPath), { recursive: true });
  const owner = `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
  const deadline = Date.now() + 1000;

  while (true) {
    try {
      const handle = await open(lockPath, 'wx');
      await handle.writeFile(owner, 'utf8');
      await handle.close();
      break;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== 'EEXIST') throw error;
      if (Date.now() >= deadline) return false;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 20));
    }
  }

  try {
    await task();
    return true;
  } finally {
    try {
      const lockContent = await readFile(lockPath, 'utf8');
      if (lockContent === owner) {
        await rm(lockPath, { force: true });
      }
    } catch {
      // lock already removed or replaced
    }
  }
}

function collectTrackedDirs(root: string, relDirs: string[]): string[] {
  const absRoot = resolve(root);
  const dirs = new Set<string>([absRoot, ...relDirs.map((dir) => resolve(absRoot, dir))]);
  return [...dirs];
}

async function createDirMtimeMap(dirs: string[]): Promise<Record<string, string>> {
  const entries = await mapLimit(dirs, STAT_CONCURRENCY, async (dir) => {
    const dirStat = await stat(dir, { bigint: true });
    return [dir, dirStat.mtimeNs.toString()] as const;
  });
  return Object.fromEntries(entries);
}

async function isFresh(entry: DiscoveryCacheEntry): Promise<boolean> {
  const checks = await mapLimit(
    Object.entries(entry.dirMtimeNs),
    STAT_CONCURRENCY,
    async ([dir, mtimeNs]) => {
      try {
        const dirStat = await stat(dir, { bigint: true });
        return dirStat.mtimeNs.toString() === mtimeNs;
      } catch {
        return false;
      }
    },
  );
  return checks.every(Boolean);
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
  const [files, dirs] = await Promise.all([
    fg(options.globPattern, {
      cwd: root,
      ignore: options.ignore,
      onlyFiles: true,
    }),
    fg('**', {
      cwd: root,
      ignore: options.ignore,
      onlyDirectories: true,
    }),
  ]);
  const trackedDirs = collectTrackedDirs(root, dirs);
  load()[key] = {
    files,
    dirMtimeNs: await createDirMtimeMap(trackedDirs),
  };
  await flush();
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
