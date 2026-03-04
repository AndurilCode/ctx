import { describe, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ENGINE = resolve(process.cwd(), 'skills/rules-to-hook/engine.mjs');

function runHook(
  payload: unknown,
  rules: unknown[],
  learnings?: unknown[],
): string {
  const workspace = mkdtempSync(join(tmpdir(), 'rules-to-hook-'));
  try {
    mkdirSync(join(workspace, '.claude'), { recursive: true });
    writeFileSync(
      join(workspace, '.claude/context-rules.json'),
      JSON.stringify(rules, null, 2),
    );
    if (learnings) {
      writeFileSync(
        join(workspace, '.claude/learnings.json'),
        JSON.stringify(learnings, null, 2),
      );
    }
    return execFileSync('node', [ENGINE], {
      cwd: workspace,
      input: JSON.stringify(payload),
      encoding: 'utf8',
    }).trim();
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}

describe('learnings inject type', () => {
  test('injects matching learnings on PostToolUse Read', () => {
    const raw = runHook(
      {
        hook_event_name: 'PostToolUse',
        tool_name: 'Read',
        tool_input: { file_path: 'src/stages/elision.ts' },
      },
      [
        {
          on: 'PostToolUse',
          when: { tool: 'Read', path: '**' },
          inject: { learnings: true },
        },
      ],
      [
        {
          files: ['src/stages/**'],
          learning: 'Stages must use AST nodes only',
          timestamp: '2026-03-04T10:00:00Z',
        },
      ],
    );

    const output = JSON.parse(raw);
    expect(output.hookSpecificOutput.additionalContext).toContain(
      '[Learnings for src/stages/elision.ts]',
    );
    expect(output.hookSpecificOutput.additionalContext).toContain(
      'Stages must use AST nodes only',
    );
  });

  test('injects multiple matching learnings', () => {
    const raw = runHook(
      {
        hook_event_name: 'PostToolUse',
        tool_name: 'Read',
        tool_input: { file_path: 'src/stages/elision.ts' },
      },
      [
        {
          on: 'PostToolUse',
          when: { tool: 'Read', path: '**' },
          inject: { learnings: true },
        },
      ],
      [
        {
          files: ['src/stages/**'],
          learning: 'Stages must use AST nodes only',
          timestamp: '2026-03-04T10:00:00Z',
        },
        {
          files: ['src/stages/elision.ts'],
          learning: 'Elision uses line-count thresholds',
          timestamp: '2026-03-04T11:00:00Z',
        },
        {
          files: ['src/core/**'],
          learning: 'Core is wiring only',
          timestamp: '2026-03-04T12:00:00Z',
        },
      ],
    );

    const output = JSON.parse(raw);
    const ctx = output.hookSpecificOutput.additionalContext;
    expect(ctx).toContain('Stages must use AST nodes only');
    expect(ctx).toContain('Elision uses line-count thresholds');
    expect(ctx).not.toContain('Core is wiring only');
  });

  test('returns nothing when no learnings match', () => {
    const raw = runHook(
      {
        hook_event_name: 'PostToolUse',
        tool_name: 'Read',
        tool_input: { file_path: 'README.md' },
      },
      [
        {
          on: 'PostToolUse',
          when: { tool: 'Read', path: '**' },
          inject: { learnings: true },
        },
      ],
      [
        {
          files: ['src/stages/**'],
          learning: 'Stages must use AST nodes only',
          timestamp: '2026-03-04T10:00:00Z',
        },
      ],
    );

    expect(raw).toBe('');
  });

  test('returns nothing when learnings.json does not exist', () => {
    const raw = runHook(
      {
        hook_event_name: 'PostToolUse',
        tool_name: 'Read',
        tool_input: { file_path: 'src/stages/elision.ts' },
      },
      [
        {
          on: 'PostToolUse',
          when: { tool: 'Read', path: '**' },
          inject: { learnings: true },
        },
      ],
      // no learnings file
    );

    expect(raw).toBe('');
  });

  test('learnings combine with text rules', () => {
    const raw = runHook(
      {
        hook_event_name: 'PostToolUse',
        tool_name: 'Read',
        tool_input: { file_path: 'src/stages/elision.ts' },
      },
      [
        {
          on: 'PostToolUse',
          when: { tool: 'Read', path: '**' },
          inject: { learnings: true },
        },
        {
          on: 'PostToolUse',
          when: { tool: 'Read', path: 'src/stages/**' },
          inject: { text: 'Stages are AST-based.' },
        },
      ],
      [
        {
          files: ['src/stages/**'],
          learning: 'Elision uses thresholds',
          timestamp: '2026-03-04T10:00:00Z',
        },
      ],
    );

    const output = JSON.parse(raw);
    const ctx = output.hookSpecificOutput.additionalContext;
    expect(ctx).toContain('[Learnings for src/stages/elision.ts]');
    expect(ctx).toContain('Elision uses thresholds');
    expect(ctx).toContain('Stages are AST-based.');
  });
});
