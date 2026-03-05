import { describe, expect, test, afterEach } from 'bun:test';
import { acquireLock, releaseLock } from '../../../../src/core/harness/lock.js';
import { existsSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const lockPath = join(tmpdir(), 'test-harness.lock');

afterEach(() => {
  try { rmdirSync(lockPath); } catch {}
});

describe('file lock', () => {
  test('acquireLock creates lock directory', () => {
    const acquired = acquireLock(lockPath, 100);
    expect(acquired).toBe(true);
    expect(existsSync(lockPath)).toBe(true);
    releaseLock(lockPath);
  });

  test('releaseLock removes lock directory', () => {
    acquireLock(lockPath, 100);
    releaseLock(lockPath);
    expect(existsSync(lockPath)).toBe(false);
  });

  test('second acquire fails while lock is held', () => {
    acquireLock(lockPath, 100);
    const second = acquireLock(lockPath, 50);
    expect(second).toBe(false);
    releaseLock(lockPath);
  });

  test('second acquire succeeds after release', () => {
    acquireLock(lockPath, 100);
    releaseLock(lockPath);
    const second = acquireLock(lockPath, 100);
    expect(second).toBe(true);
    releaseLock(lockPath);
  });
});
