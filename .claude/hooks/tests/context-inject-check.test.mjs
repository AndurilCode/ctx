// .claude/hooks/tests/context-inject-check.test.mjs
// Tests for --check CLI flag in context-inject.mjs
import { describe, test, expect } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const HOOK = new URL('../context-inject.mjs', import.meta.url).pathname;

describe('context-inject --check CLI', () => {
  test('--check flag outputs health check results to stdout', () => {
    const cwd = join(tmpdir(), 'hook-test-' + Date.now() + '-' + Math.random());
    mkdirSync(join(cwd, '.claude'), { recursive: true });
    try {
      writeFileSync(join(cwd, '.claude', 'context-rules.json'), JSON.stringify([
        { on: 'FakeEvent', inject: { text: 'bad rule' } },
      ]));
      const result = spawnSync('node', [HOOK, '--check'], {
        input: '',
        cwd,
        encoding: 'utf8',
      });
      expect(result.stdout).toContain('FakeEvent');
      expect(result.status).toBe(1);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('--check flag exits 0 for valid config', () => {
    const cwd = join(tmpdir(), 'hook-test-' + Date.now() + '-' + Math.random());
    mkdirSync(join(cwd, '.claude'), { recursive: true });
    try {
      writeFileSync(join(cwd, '.claude', 'context-rules.json'), JSON.stringify([
        { on: 'PreToolUse', when: { tool: 'Read' }, inject: { text: 'hello' } },
      ]));
      const result = spawnSync('node', [HOOK, '--check'], {
        input: '',
        cwd,
        encoding: 'utf8',
      });
      expect(result.status).toBe(0);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
