import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * Returns absolute paths of files changed relative to diffBase.
 * Returns [] if git is unavailable, diffBase is invalid, or not in a git repo.
 */
export function getChangedFiles(root: string, diffBase: string): string[] {
  const result = spawnSync('git', ['diff', '--name-only', diffBase], {
    cwd: resolve(root),
    encoding: 'utf8',
  });
  if (result.status !== 0 || !result.stdout) return [];
  return result.stdout
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean)
    .map((f) => resolve(root, f));
}
