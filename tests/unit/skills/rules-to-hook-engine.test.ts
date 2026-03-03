import { describe, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ENGINE = resolve(process.cwd(), 'skills/rules-to-hook/engine.mjs');

const BASE_RULES = [
  {
    on: 'PreToolUse',
    when: { tool: 'Edit', path: 'src/**' },
    inject: { text: 'Rule: write only in src' },
  },
];

function runHook(payload: unknown, rules = BASE_RULES): string {
  const workspace = mkdtempSync(join(tmpdir(), 'rules-to-hook-'));
  try {
    mkdirSync(join(workspace, '.claude'), { recursive: true });
    writeFileSync(join(workspace, '.claude/context-rules.json'), JSON.stringify(rules, null, 2));
    return execFileSync('node', [ENGINE], {
      cwd: workspace,
      input: JSON.stringify(payload),
      encoding: 'utf8',
    }).trim();
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}

describe('rules-to-hook engine Phase 1 adapters', () => {
  test('returns Claude-compatible output for Claude payloads', () => {
    const raw = runHook({
      hook_event_name: 'PreToolUse',
      tool_name: 'Edit',
      tool_input: { file_path: 'src/core/context.ts' },
    });

    const output = JSON.parse(raw);
    expect(output.hookSpecificOutput.hookEventName).toBe('PreToolUse');
    expect(output.hookSpecificOutput.additionalContext).toBe('Rule: write only in src');
    expect(output.continue).toBeUndefined();
    expect(output.systemMessage).toBeUndefined();
  });

  test('returns VS Code-compatible output for VS Code payloads', () => {
    const raw = runHook({
      hookEventName: 'PreToolUse',
      toolName: 'Edit',
      toolInput: { filePath: 'src/core/context.ts' },
    });

    const output = JSON.parse(raw);
    expect(output.continue).toBe(true);
    expect(output.systemMessage).toBe('Rule: write only in src');
    expect(output.hookSpecificOutput.hookEventName).toBe('PreToolUse');
    expect(output.hookSpecificOutput.additionalContext).toBe('Rule: write only in src');
  });

  test('exits quietly when no rule matches', () => {
    const raw = runHook({
      hookEventName: 'PreToolUse',
      toolName: 'Read',
      toolInput: { filePath: 'README.md' },
    });

    expect(raw).toBe('');
  });
});

describe('installer engine sync', () => {
  test('installer overwrites stale deployed engine', () => {
    const installer = readFileSync(
      resolve(process.cwd(), 'skills/rules-to-hook/install.mjs'),
      'utf8',
    );
    expect(installer).not.toContain('!existsSync(ENGINE_DST)');
    expect(installer).toContain('copyFileSync(ENGINE_SRC, ENGINE_DST)');
  });
});
