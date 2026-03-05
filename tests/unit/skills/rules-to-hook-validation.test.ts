import { describe, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ENGINE = resolve(process.cwd(), 'skills/rules-to-hook/engine.mjs');

function runHook(payload: unknown, rules: unknown[]): string {
  const workspace = mkdtempSync(join(tmpdir(), 'rules-to-hook-validation-'));
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

describe('rule validation', () => {
  test('ignores rules with multiple inject keys', () => {
    const raw = runHook(
      {
        hook_event_name: 'PreToolUse',
        tool_name: 'Edit',
        tool_input: { file_path: 'src/core/a.ts' },
      },
      [{
        on: 'PreToolUse',
        when: { tool: 'Edit', path: 'src/**' },
        inject: { text: 'a', hint: 'b' },
      }],
    );
    expect(raw).toBe('');
  });

  test('ignores shell rules with semicolon', () => {
    const raw = runHook(
      {
        hook_event_name: 'PreToolUse',
        tool_name: 'Edit',
        tool_input: { file_path: 'src/core/a.ts' },
      },
      [{
        on: 'PreToolUse',
        when: { tool: 'Edit', path: 'src/**' },
        inject: { shell: 'echo hi; echo bye' },
      }],
    );
    expect(raw).toBe('');
  });

  test('ignores shell rules with &&', () => {
    const raw = runHook(
      {
        hook_event_name: 'PreToolUse',
        tool_name: 'Edit',
        tool_input: { file_path: 'src/core/a.ts' },
      },
      [{
        on: 'PreToolUse',
        when: { tool: 'Edit', path: 'src/**' },
        inject: { shell: 'echo hi && echo bye' },
      }],
    );
    expect(raw).toBe('');
  });

  test('ignores allow rules outside PreToolUse', () => {
    const raw = runHook(
      {
        hook_event_name: 'PostToolUse',
        tool_name: 'Read',
        tool_input: { file_path: 'README.md' },
      },
      [{
        on: 'PostToolUse',
        when: { tool: 'Read' },
        inject: { allow: 'should not apply' },
      }],
    );
    expect(raw).toBe('');
  });

  test('ignores rules with empty path', () => {
    const raw = runHook(
      {
        hook_event_name: 'PreToolUse',
        tool_name: 'Edit',
        tool_input: { file_path: 'src/core/a.ts' },
      },
      [{
        on: 'PreToolUse',
        when: { tool: 'Edit', path: '' },
        inject: { text: 'too broad' },
      }],
    );
    expect(raw).toBe('');
  });

  test('applies valid rules even when mixed with invalid ones', () => {
    const raw = runHook(
      {
        hook_event_name: 'PreToolUse',
        tool_name: 'Edit',
        tool_input: { file_path: 'src/core/a.ts' },
      },
      [
        {
          on: 'PreToolUse',
          when: { tool: 'Edit', path: '' },
          inject: { text: 'invalid empty path' },
        },
        {
          on: 'PreToolUse',
          when: { tool: 'Edit', path: 'src/**' },
          inject: { text: 'valid context' },
        },
      ],
    );
    const output = JSON.parse(raw);
    expect(output.hookSpecificOutput.additionalContext).toBe('valid context');
  });
});
