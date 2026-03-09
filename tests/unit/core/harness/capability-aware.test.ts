import { describe, expect, test } from 'bun:test';
import { evaluate } from '../../../../src/core/harness/runtime.js';
import { buildRequest } from '../../../../src/core/harness/normalize.js';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const tmpDir = join(tmpdir(), `harness-cap-${Date.now()}`);
const statePath = join(tmpDir, 'state.json');
const testFile = join(tmpDir, 'test.ts');

function setup() {
  mkdirSync(tmpDir, { recursive: true });
  writeFileSync(testFile, 'export const x = 1;\n'.repeat(50));
  if (existsSync(statePath)) rmSync(statePath);
}
function cleanup() { if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true }); }

describe('Phase 2: executable rewrite on capable surface', () => {
  test('mcp surface gets executable rewrite for unscoped grep', async () => {
    setup();
    try {
      const req = buildRequest({ surface: 'mcp', event: 'PreToolUse', toolName: 'Grep', toolInput: { pattern: 'TODO' } });
      const r = await evaluate(req, { statePath });
      expect(r.action).toBe('rewrite');
      if (r.action === 'rewrite') {
        expect(r.output.type).toBe('execute');
        if (r.output.type === 'execute') {
          expect(r.output.tool).toBe('rank');
        }
      }
    } finally { cleanup(); }
  });

  test('claude-hook surface gets advisory rewrite for unscoped grep', async () => {
    setup();
    try {
      const req = buildRequest({ surface: 'claude-hook', event: 'PreToolUse', toolName: 'Grep', toolInput: { pattern: 'TODO' } });
      const r = await evaluate(req, { statePath });
      expect(r.action).toBe('rewrite');
      if (r.action === 'rewrite') {
        expect(r.output.type).toBe('context');
      }
    } finally { cleanup(); }
  });
});

describe('Phase 2: return_cached on capable vs incapable surface', () => {
  test('mcp surface returns cached result on re-read', async () => {
    setup();
    try {
      const req = buildRequest({ surface: 'mcp', event: 'PreToolUse', toolName: 'Read', toolInput: { file: testFile }, rawPath: testFile });
      await evaluate(req, { statePath }); // first read → allow
      const r2 = await evaluate(req, { statePath }); // second read
      expect(r2.action).toBe('return_cached');
      if (r2.action === 'return_cached') {
        expect(r2.output.file).toBe(testFile);
      }
    } finally { cleanup(); }
  });

  test('claude-hook surface downgrades return_cached to deny', async () => {
    setup();
    try {
      const req = buildRequest({ surface: 'claude-hook', event: 'PreToolUse', toolName: 'Read', toolInput: { file: testFile }, rawPath: testFile });
      await evaluate(req, { statePath }); // first read → allow
      const r2 = await evaluate(req, { statePath }); // second read
      expect(r2.action).toBe('warn');
      if (r2.action === 'warn') {
        expect(r2.output.value).toContain('Already read');
      }
    } finally { cleanup(); }
  });
});
