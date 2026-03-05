// .claude/hooks/tests/health-check.test.mjs
import { describe, test, expect } from 'bun:test';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { runHealthCheck } from '../health-check.mjs';

function makeCwd() {
  const cwd = join(tmpdir(), 'hc-test-' + Date.now() + '-' + Math.random());
  mkdirSync(join(cwd, '.claude'), { recursive: true });
  return cwd;
}

function writeRules(cwd, data) {
  writeFileSync(join(cwd, '.claude', 'context-rules.json'), typeof data === 'string' ? data : JSON.stringify(data));
}

describe('runHealthCheck', () => {
  test('returns ok for valid config', () => {
    const cwd = makeCwd();
    try {
      writeRules(cwd, [
        { on: 'PreToolUse', when: { tool: 'Read' }, inject: { text: 'hello' } },
      ]);
      mkdirSync(join(cwd, 'dist'), { recursive: true });
      writeFileSync(join(cwd, 'dist', 'index.js'), '// stub');
      const result = runHealthCheck(cwd);
      expect(result.ok).toBe(true);
      expect(result.issues).toEqual([]);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('error when config is invalid JSON', () => {
    const cwd = makeCwd();
    try {
      writeRules(cwd, '{not valid json!!!');
      const result = runHealthCheck(cwd);
      expect(result.ok).toBe(false);
      expect(result.issues.some(i => i.level === 'error' && /parse|json/i.test(i.message))).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('error when config is not an array', () => {
    const cwd = makeCwd();
    try {
      writeRules(cwd, { on: 'PreToolUse', inject: { text: 'hi' } });
      const result = runHealthCheck(cwd);
      expect(result.ok).toBe(false);
      expect(result.issues.some(i => i.level === 'error' && /array/i.test(i.message))).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('error for rule with unknown event', () => {
    const cwd = makeCwd();
    try {
      writeRules(cwd, [
        { on: 'BogusEvent', inject: { text: 'hi' } },
      ]);
      const result = runHealthCheck(cwd);
      expect(result.ok).toBe(false);
      expect(result.issues.some(i => i.level === 'error' && /unknown event|invalid.*event|BogusEvent/i.test(i.message))).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('error for invalid regex in when clause', () => {
    const cwd = makeCwd();
    try {
      writeRules(cwd, [
        { on: 'PreToolUse', when: { tool: '[invalid(' }, inject: { text: 'hi' } },
      ]);
      const result = runHealthCheck(cwd);
      expect(result.ok).toBe(false);
      expect(result.issues.some(i => i.level === 'error' && /regex|regexp|invalid/i.test(i.message))).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('error for inject.shell usage', () => {
    const cwd = makeCwd();
    try {
      writeRules(cwd, [
        { on: 'PreToolUse', inject: { shell: 'echo hi' } },
      ]);
      const result = runHealthCheck(cwd);
      expect(result.ok).toBe(false);
      expect(result.issues.some(i => i.level === 'error' && /shell/i.test(i.message))).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('error for unknown inject keys', () => {
    const cwd = makeCwd();
    try {
      writeRules(cwd, [
        { on: 'PreToolUse', inject: { text: 'hi', bogusKey: 'bad' } },
      ]);
      const result = runHealthCheck(cwd);
      expect(result.ok).toBe(false);
      expect(result.issues.some(i => i.level === 'error' && /unknown.*inject|bogusKey/i.test(i.message))).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('warn when harness dist is missing', () => {
    const cwd = makeCwd();
    try {
      writeRules(cwd, [
        { on: 'PreToolUse', inject: { text: 'hi' } },
      ]);
      // deliberately do NOT create dist/index.js
      const result = runHealthCheck(cwd);
      expect(result.ok).toBe(true); // warn-only, so ok is still true
      expect(result.issues.some(i => i.level === 'warn' && /dist/i.test(i.message))).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('ok is true when only warn-level issues exist', () => {
    const cwd = makeCwd();
    try {
      writeRules(cwd, [
        { on: 'PreToolUse', inject: { text: 'hi' } },
      ]);
      const result = runHealthCheck(cwd);
      // No dist → warn, but ok should still be true
      const hasErrors = result.issues.some(i => i.level === 'error');
      expect(hasErrors).toBe(false);
      expect(result.ok).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('error when rule has no inject clause', () => {
    const cwd = makeCwd();
    try {
      writeRules(cwd, [
        { on: 'PreToolUse', when: { tool: 'Read' } },
      ]);
      const result = runHealthCheck(cwd);
      expect(result.ok).toBe(false);
      expect(result.issues.some(i => i.level === 'error' && /inject/i.test(i.message))).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
