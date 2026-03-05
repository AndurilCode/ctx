import { mkdirSync, rmdirSync } from 'node:fs';

/**
 * Acquire a file-system lock using mkdir (atomic on all platforms).
 * Spins with 5ms intervals up to timeoutMs. Returns true if acquired.
 */
export function acquireLock(lockPath: string, timeoutMs: number): boolean {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      mkdirSync(lockPath);
      return true;
    } catch {
      // Lock exists — spin wait
      const wait = Math.min(5, deadline - Date.now());
      if (wait > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, wait);
    }
  }
  return false;
}

/**
 * Release a file-system lock.
 */
export function releaseLock(lockPath: string): void {
  try {
    rmdirSync(lockPath);
  } catch { /* already released */ }
}
