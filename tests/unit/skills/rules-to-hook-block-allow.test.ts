import { describe, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ENGINE = resolve(process.cwd(), 'skills/rules-to-hook/engine.mjs');

function runHook(payload: unknown, rules: unknown[]): string {
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

describe('block/allow rules', () => {
  test('block rule returns permissionDecision deny with reason', () => {
    const raw = runHook({
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'rm -rf /' },
    }, [
      {
        on: 'PreToolUse',
        when: { tool: 'Bash', command: 'rm -rf' },
        inject: { block: 'Destructive rm -rf is not allowed.' },
      },
    ]);

    const output = JSON.parse(raw);
    expect(output.hookSpecificOutput.permissionDecision).toBe('deny');
    expect(output.hookSpecificOutput.permissionDecisionReason).toBe(
      'Destructive rm -rf is not allowed.',
    );
  });

  test('allow rule returns permissionDecision allow with reason', () => {
    const raw = runHook({
      hook_event_name: 'PreToolUse',
      tool_name: 'Read',
      tool_input: { file_path: 'docs/README.md' },
    }, [
      {
        on: 'PreToolUse',
        when: { tool: 'Read', path: 'docs/**' },
        inject: { allow: 'Safe: reading documentation.' },
      },
    ]);

    const output = JSON.parse(raw);
    expect(output.hookSpecificOutput.permissionDecision).toBe('allow');
    expect(output.hookSpecificOutput.permissionDecisionReason).toBe(
      'Safe: reading documentation.',
    );
  });

  test('block + context rules: deny with context injected', () => {
    const raw = runHook({
      hook_event_name: 'PreToolUse',
      tool_name: 'Edit',
      tool_input: { file_path: 'src/core/index.ts' },
    }, [
      {
        on: 'PreToolUse',
        when: { tool: 'Edit', path: 'src/core/**' },
        inject: { block: 'Core is frozen during release.' },
      },
      {
        on: 'PreToolUse',
        when: { tool: 'Edit', path: 'src/**' },
        inject: { text: 'Remember: core is zero-dep.' },
      },
    ]);

    const output = JSON.parse(raw);
    expect(output.hookSpecificOutput.permissionDecision).toBe('deny');
    expect(output.hookSpecificOutput.permissionDecisionReason).toBe(
      'Core is frozen during release.',
    );
    expect(output.hookSpecificOutput.additionalContext).toBe(
      'Remember: core is zero-dep.',
    );
  });

  test('allow + context rules: allow with context injected', () => {
    const raw = runHook({
      hook_event_name: 'PreToolUse',
      tool_name: 'Read',
      tool_input: { file_path: 'docs/guide.md' },
    }, [
      {
        on: 'PreToolUse',
        when: { tool: 'Read', path: 'docs/**' },
        inject: { allow: 'Auto-approved: docs are safe.' },
      },
      {
        on: 'PreToolUse',
        when: { tool: 'Read', path: '**/*.md' },
        inject: { text: 'Markdown files are documentation.' },
      },
    ]);

    const output = JSON.parse(raw);
    expect(output.hookSpecificOutput.permissionDecision).toBe('allow');
    expect(output.hookSpecificOutput.permissionDecisionReason).toBe(
      'Auto-approved: docs are safe.',
    );
    expect(output.hookSpecificOutput.additionalContext).toBe(
      'Markdown files are documentation.',
    );
  });

  test('block wins over allow when both match', () => {
    const raw = runHook({
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'rm -rf node_modules' },
    }, [
      {
        on: 'PreToolUse',
        when: { tool: 'Bash' },
        inject: { allow: 'Bash is generally allowed.' },
      },
      {
        on: 'PreToolUse',
        when: { tool: 'Bash', command: 'rm -rf' },
        inject: { block: 'No destructive deletes.' },
      },
    ]);

    const output = JSON.parse(raw);
    expect(output.hookSpecificOutput.permissionDecision).toBe('deny');
    expect(output.hookSpecificOutput.permissionDecisionReason).toBe(
      'No destructive deletes.',
    );
  });

  test('block/allow on non-PreToolUse events are ignored by engine', () => {
    const raw = runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Read',
      tool_input: { file_path: 'src/foo.ts' },
    }, [
      {
        on: 'PostToolUse',
        when: { tool: 'Read' },
        inject: { block: 'Should be ignored.' },
      },
    ]);

    // Engine treats block/allow as context on non-PreToolUse — no permissionDecision
    expect(raw).toBe('');
  });

  test('VS Code block returns flat permissionDecision (no hookSpecificOutput wrapper)', () => {
    const raw = runHook({
      hookEventName: 'PreToolUse',
      toolName: 'Bash',
      toolInput: { command: 'rm -rf /' },
    }, [
      {
        on: 'PreToolUse',
        when: { tool: 'Bash', command: 'rm -rf' },
        inject: { block: 'Blocked.' },
      },
    ]);

    const output = JSON.parse(raw);
    // VS Code: flat output, no hookSpecificOutput wrapper
    expect(output.permissionDecision).toBe('deny');
    expect(output.permissionDecisionReason).toBe('Blocked.');
    expect(output.continue).toBeUndefined();
    expect(output.hookSpecificOutput).toBeUndefined();
  });
});
