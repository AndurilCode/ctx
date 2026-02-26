import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { BigIntStats } from 'node:fs';
import { stat } from 'node:fs/promises';
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

function flushIfDirty(): void {
  if (!dirty) return;
  mkdirSync(dirname(activeCachePath), { recursive: true });
  writeFileSync(activeCachePath, JSON.stringify(load()), 'utf8');
  dirty = false;
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

export function commitRelevanceMetadata(): void {
  flushIfDirty();
}

/** Reset in-memory cache and optionally redirect to a different file. Tests only. */
export function _resetRelevanceCacheForTesting(path?: string): void {
  cache = null;
  dirty = false;
  activeCachePath = path ?? DEFAULT_CACHE_PATH;
}
