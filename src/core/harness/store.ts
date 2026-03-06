import { readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { HarnessState } from '../../types/harness.js';
import { createHarnessState } from './state.js';
import { serialize, deserialize } from './serialize.js';

export function resolveStatePath(cwd: string): string {
  return join(cwd, '.claude', 'harness-state.json');
}

export function loadState(statePath: string, contextWindow = 200_000): HarnessState {
  try {
    const raw = readFileSync(statePath, 'utf8');
    return deserialize(JSON.parse(raw));
  } catch {
    return createHarnessState({ contextWindow });
  }
}

export function saveState(statePath: string, state: HarnessState): void {
  const tmp = statePath + '.tmp.' + process.pid;
  writeFileSync(tmp, JSON.stringify(serialize(state), null, 2));
  renameSync(tmp, statePath);
}

export function resetState(statePath: string): void {
  try { unlinkSync(statePath); } catch { /* may not exist */ }
}
