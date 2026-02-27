import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _resetForTesting, getCached, setCached } from '../../../src/utils/summary-cache.js';

let tmpPath: string;

beforeEach(() => {
  tmpPath = join(mkdtempSync(join(tmpdir(), 'ctx-cache-test-')), 'cache.json');
  _resetForTesting(tmpPath);
});

afterEach(() => {
  _resetForTesting();
});

describe('getCached', () => {
  test('returns undefined on miss', () => {
    expect(getCached('section-a', 'hash1')).toBeUndefined();
  });

  test('returns cached summary when section key and content hash both match', () => {
    setCached('section-a', 'hash1', 'my summary');
    expect(getCached('section-a', 'hash1')).toBe('my summary');
  });

  test('returns undefined when section key matches but content hash differs (stale)', () => {
    setCached('section-a', 'hash1', 'old summary');
    expect(getCached('section-a', 'hash2')).toBeUndefined();
  });

  test('is isolated per section key', () => {
    setCached('section-a', 'hash1', 'summary A');
    setCached('section-b', 'hash1', 'summary B');
    expect(getCached('section-a', 'hash1')).toBe('summary A');
    expect(getCached('section-b', 'hash1')).toBe('summary B');
  });
});

describe('setCached', () => {
  test('replaces prior entry for the same section key when content changes', () => {
    setCached('section-a', 'hash1', 'old summary');
    setCached('section-a', 'hash2', 'new summary');
    expect(getCached('section-a', 'hash1')).toBeUndefined();
    expect(getCached('section-a', 'hash2')).toBe('new summary');
  });

  test('persists to disk immediately', () => {
    setCached('section-a', 'hash1', 'persisted summary');
    const raw = JSON.parse(readFileSync(tmpPath, 'utf8')) as Record<
      string,
      { contentHash: string; summary: string }
    >;
    expect(raw['section-a']?.contentHash).toBe('hash1');
    expect(raw['section-a']?.summary).toBe('persisted summary');
  });
});

describe('persistence across reloads', () => {
  test('data written to disk survives an in-memory reset', () => {
    setCached('section-a', 'hash1', 'durable summary');
    _resetForTesting(tmpPath);
    expect(getCached('section-a', 'hash1')).toBe('durable summary');
  });

  test('starts empty when cache file does not exist', () => {
    const nonExistent = join(tmpdir(), `ctx-no-file-${Date.now()}.json`);
    _resetForTesting(nonExistent);
    expect(getCached('section-a', 'hash1')).toBeUndefined();
  });
});
