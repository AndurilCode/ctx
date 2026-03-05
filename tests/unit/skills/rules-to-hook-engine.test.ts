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

function runHook(payload: unknown, rules = BASE_RULES, eventArg?: string): string {
  const workspace = mkdtempSync(join(tmpdir(), 'rules-to-hook-'));
  try {
    mkdirSync(join(workspace, '.claude'), { recursive: true });
    writeFileSync(join(workspace, '.claude/context-rules.json'), JSON.stringify(rules, null, 2));
    const args = eventArg ? [ENGINE, eventArg] : [ENGINE];
    return execFileSync('node', args, {
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

  test('VS Code context-only rules produce no output (context injection unsupported)', () => {
    const raw = runHook({
      hookEventName: 'PreToolUse',
      toolName: 'Edit',
      toolInput: { filePath: 'src/core/context.ts' },
    });

    // VS Code doesn't support context injection — only block/allow on PreToolUse
    expect(raw).toBe('');
  });

  test('exits quietly when no rule matches', () => {
    const raw = runHook({
      hookEventName: 'PreToolUse',
      toolName: 'Read',
      toolInput: { filePath: 'README.md' },
    });

    expect(raw).toBe('');
  });

  test('VS Code toolArgs (JSON string) is parsed into tool input', () => {
    // VS Code sends toolArgs as a JSON string and event via CLI arg
    const raw = runHook({
      toolName: 'Edit',
      toolArgs: JSON.stringify({ file_path: 'src/core/context.ts' }),
    }, [
      {
        on: 'PreToolUse',
        when: { tool: 'Edit', path: 'src/**' },
        inject: { block: 'Blocked via toolArgs.' },
      },
    ], 'preToolUse');

    const output = JSON.parse(raw);
    expect(output.permissionDecision).toBe('deny');
    expect(output.permissionDecisionReason).toBe('Blocked via toolArgs.');
  });

  test('CLI event argument normalizes camelCase to PascalCase', () => {
    const raw = runHook({
      toolName: 'Bash',
      toolArgs: '{}',
    }, [
      {
        on: 'PreToolUse',
        when: { tool: 'Bash' },
        inject: { block: 'Blocked via CLI event.' },
      },
    ], 'preToolUse');

    const output = JSON.parse(raw);
    expect(output.permissionDecision).toBe('deny');
    expect(output.permissionDecisionReason).toBe('Blocked via CLI event.');
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
    expect(installer).toContain('copyFileSync(HARNESS_EVAL_SRC, HARNESS_EVAL_DST)');
    expect(installer).toContain('copyFileSync(HARNESS_FORMAT_SRC, HARNESS_FORMAT_DST)');
    expect(installer).toContain("'PreCompact'");
  });
});
