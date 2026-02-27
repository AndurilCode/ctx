import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const DEFAULT_CACHE_PATH = join(homedir(), '.cache', 'ctx', 'summary-cache.json');

let activeCachePath = DEFAULT_CACHE_PATH;

interface CacheEntry {
  contentHash: string;
  summary: string;
}

type CacheStore = Record<string, CacheEntry>;

let cache: CacheStore | null = null;

function load(): CacheStore {
  if (cache !== null) return cache;
  try {
    cache = JSON.parse(readFileSync(activeCachePath, 'utf8')) as CacheStore;
  } catch {
    cache = {};
  }
  return cache;
}

function flush(): void {
  mkdirSync(dirname(activeCachePath), { recursive: true });
  writeFileSync(activeCachePath, JSON.stringify(load(), null, 2), 'utf8');
}

/** Reset in-memory cache and optionally redirect to a different file. Tests only. */
export function _resetForTesting(path?: string): void {
  cache = null;
  activeCachePath = path ?? DEFAULT_CACHE_PATH;
}

/**
 * Look up a cached summary.
 * @param sectionKey - stable identity of the section (file + filters)
 * @param contentHash - hash of the current section content
 * @returns the cached summary, or undefined on miss or stale content
 */
export function getCached(sectionKey: string, contentHash: string): string | undefined {
  const entry = load()[sectionKey];
  return entry?.contentHash === contentHash ? entry.summary : undefined;
}

/**
 * Store a summary, replacing any prior entry for the same section.
 */
export function setCached(sectionKey: string, contentHash: string, summary: string): void {
  load()[sectionKey] = { contentHash, summary };
  flush();
}
