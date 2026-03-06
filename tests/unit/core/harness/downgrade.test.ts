import { describe, expect, test } from 'bun:test';
import { evaluate } from '../../../../src/core/harness/runtime.js';
import { loadState } from '../../../../src/core/harness/store.js';
import { buildRequest } from '../../../../src/core/harness/normalize.js';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const tmpDir = join(tmpdir(), `harness-dg-${Date.now()}`);
const statePath = join(tmpDir, 'state.json');
const testFile = join(tmpDir, 'test.ts');

function setup() {
  mkdirSync(tmpDir, { recursive: true });
  writeFileSync(testFile, 'export const x = 1;\n'.repeat(50));
  if (existsSync(statePath)) rmSync(statePath);
}
function cleanup() { if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true }); }

describe('Phase 2: downgrade counters', () => {
  test('rewrite downgrade increments counter on claude-hook', async () => {
    setup();
    try {
      const req = buildRequest({ surface: 'claude-hook', event: 'PreToolUse', toolName: 'Grep', toolInput: { pattern: 'foo' } });
      await evaluate(req, { statePath });
      const state = loadState(statePath);
      expect(state.downgrades.rewriteToContext).toBe(1);
      expect(state.downgrades.total).toBe(1);
    } finally { cleanup(); }
  });

  test('return_cached downgrade increments counter on claude-hook', async () => {
    setup();
    try {
      const req = buildRequest({ surface: 'claude-hook', event: 'PreToolUse', toolName: 'Read', toolInput: { file: testFile }, rawPath: testFile });
      await evaluate(req, { statePath }); // first → allow
      await evaluate(req, { statePath }); // second → downgrade
      const state = loadState(statePath);
      expect(state.downgrades.returnCachedToDeny).toBe(1);
      expect(state.downgrades.total).toBe(1);
    } finally { cleanup(); }
  });

  test('no downgrade on capable surface (mcp)', async () => {
    setup();
    try {
      const req = buildRequest({ surface: 'mcp', event: 'PreToolUse', toolName: 'Grep', toolInput: { pattern: 'bar' } });
      await evaluate(req, { statePath });
      const state = loadState(statePath);
      expect(state.downgrades.total).toBe(0);
    } finally { cleanup(); }
  });
});
