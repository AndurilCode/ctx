import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import type { BigIntStats } from 'node:fs';
import { open, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const DEFAULT_CACHE_PATH = join(tmpdir(), 'compact-md', 'relevance-cache.json');

interface RelevanceCacheEntry {
  mtimeNs: string;
  size: string;
  symbols: string[];
  headings: string[];
}

type RelevanceCacheStore = Record<string, RelevanceCacheEntry>;

let activeCachePath = DEFAULT_CACHE_PATH;
let cache: RelevanceCacheStore | null = null;
let dirty = false;

function load(): RelevanceCacheStore {
  if (cache !== null) return cache;
  try {
    cache = JSON.parse(readFileSync(activeCachePath, 'utf8')) as RelevanceCacheStore;
  } catch {
    cache = {};
  }
  return cache;
}

function statSignature(fileStat: BigIntStats): { mtimeNs: string; size: string } {
  return { mtimeNs: fileStat.mtimeNs.toString(), size: fileStat.size.toString() };
}

function isFresh(entry: RelevanceCacheEntry | undefined, fileStat: BigIntStats): boolean {
  if (!entry) return false;
  const sig = statSignature(fileStat);
  return entry.mtimeNs === sig.mtimeNs && entry.size === sig.size;
}

async function flushIfDirty(): Promise<void> {
  if (!dirty) return;
  const flushed = await withCacheLock(activeCachePath, async () => {
    mkdirSync(dirname(activeCachePath), { recursive: true });
    const diskStore = await readDiskAsync();
    const merged = { ...diskStore, ...load() };
    writeAtomically(activeCachePath, JSON.stringify(merged));
    cache = merged;
    dirty = false;
  });
  if (!flushed) return;
}

async function readDiskAsync(): Promise<RelevanceCacheStore> {
  try {
    return JSON.parse(await readFile(activeCachePath, 'utf8')) as RelevanceCacheStore;
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

export async function getRelevanceMetadata(
  file: string,
): Promise<{ symbols: string[]; headings: string[] } | null> {
  const absFile = resolve(file);
  let fileStat: BigIntStats;
  try {
    fileStat = await stat(absFile, { bigint: true });
  } catch {
    return null;
  }

  const entry = load()[absFile];
  if (!entry || !isFresh(entry, fileStat)) return null;
  return { symbols: entry.symbols, headings: entry.headings };
}

export async function setRelevanceMetadata(
  file: string,
  symbols: string[],
  headings: string[],
): Promise<void> {
  const absFile = resolve(file);
  const fileStat = await stat(absFile, { bigint: true });
  const sig = statSignature(fileStat);
  load()[absFile] = { ...sig, symbols, headings };
  dirty = true;
}

export async function commitRelevanceMetadata(): Promise<void> {
  await flushIfDirty();
}

/** Reset in-memory cache and optionally redirect to a different file. Tests only. */
export function _resetRelevanceCacheForTesting(path?: string): void {
  cache = null;
  dirty = false;
  activeCachePath = path ?? DEFAULT_CACHE_PATH;
}
