// .claude/hooks/tests/context-inject.test.mjs
import { describe, test, expect } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const HOOK = new URL('../context-inject.mjs', import.meta.url).pathname;

function runHook(input, rules) {
  const cwd = join(tmpdir(), 'hook-test-' + Date.now() + '-' + Math.random());
  mkdirSync(join(cwd, '.claude'), { recursive: true });
  try {
    if (rules !== null) {
      writeFileSync(join(cwd, 'context-rules.json'), JSON.stringify(rules));
    }
    const result = spawnSync('node', [HOOK], {
      input: JSON.stringify(input),
      cwd,
      encoding: 'utf8',
    });
    if (result.stdout.trim() === '') return null;
    return JSON.parse(result.stdout);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

function runHookRaw(input, configContent) {
  const cwd = join(tmpdir(), 'hook-test-' + Date.now() + '-' + Math.random());
  mkdirSync(join(cwd, '.claude'), { recursive: true });
  try {
    if (configContent !== null) {
      writeFileSync(join(cwd, 'context-rules.json'), typeof configContent === 'string' ? configContent : JSON.stringify(configContent));
    }
    return spawnSync('node', [HOOK], {
      input: JSON.stringify(input),
      cwd,
      encoding: 'utf8',
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

describe('context-inject hook', () => {
  test('emits nothing when no rules match', () => {
    const result = runHook(
      { hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: 'src/foo.ts' } },
      [{ on: 'PreToolUse', when: { tool: 'Write', path: 'src/**' }, inject: { text: 'hello' } }],
    );
    expect(result).toBeNull();
  });

  test('injects text when tool and path match', () => {
    const result = runHook(
      {
        hook_event_name: 'PreToolUse',
        tool_name: 'Read',
        tool_input: { file_path: 'src/stages/fold.ts' },
      },
      [
        {
          on: 'PreToolUse',
          when: { tool: 'Read', path: 'src/stages/**' },
          inject: { text: 'AST only!' },
        },
      ],
    );
    expect(result).not.toBeNull();
    expect(result.hookSpecificOutput.hookEventName).toBe('PreToolUse');
    expect(result.hookSpecificOutput.additionalContext).toContain('AST only!');
  });

  test('injects hint with "Related:" prefix', () => {
    const result = runHook(
      {
        hook_event_name: 'PostToolUse',
        tool_name: 'Read',
        tool_input: { file_path: 'src/parser/index.ts' },
      },
      [
        {
          on: 'PostToolUse',
          when: { tool: 'Read', path: 'src/parser/**' },
          inject: { hint: 'docs/parser.md §Design' },
        },
      ],
    );
    expect(result).not.toBeNull();
    expect(result.hookSpecificOutput.hookEventName).toBe('PostToolUse');
    expect(result.hookSpecificOutput.additionalContext).toContain(
      'Related: docs/parser.md §Design',
    );
  });

  test('matches UserPromptSubmit on prompt regex', () => {
    const result = runHook(
      { hook_event_name: 'UserPromptSubmit', prompt: 'how does the round-trip work?' },
      [
        {
          on: 'UserPromptSubmit',
          when: { prompt: 'round.trip|lossless' },
          inject: { text: 'expand(compact(md)) === md' },
        },
      ],
    );
    expect(result).not.toBeNull();
    expect(result.hookSpecificOutput.hookEventName).toBe('UserPromptSubmit');
    expect(result.hookSpecificOutput.additionalContext).toContain('expand(compact(md))');
  });

  test('concatenates multiple matching rules', () => {
    const result = runHook(
      {
        hook_event_name: 'PreToolUse',
        tool_name: 'Read',
        tool_input: { file_path: 'src/stages/fold.ts' },
      },
      [
        {
          on: 'PreToolUse',
          when: { tool: 'Read', path: 'src/stages/**' },
          inject: { text: 'Rule A' },
        },
        { on: 'PreToolUse', when: { tool: 'Read', path: 'src/**' }, inject: { text: 'Rule B' } },
      ],
    );
    expect(result).not.toBeNull();
    expect(result.hookSpecificOutput.hookEventName).toBe('PreToolUse');
    const ctx = result.hookSpecificOutput.additionalContext;
    expect(ctx).toContain('Rule A');
    expect(ctx).toContain('Rule B');
  });

  test('exits silently when config is missing', () => {
    const result = runHook(
      { hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: 'src/foo.ts' } },
      null,
    );
    expect(result).toBeNull();
  });

  test('matches pipe-separated tool alternatives', () => {
    const result = runHook(
      {
        hook_event_name: 'PreToolUse',
        tool_name: 'Edit',
        tool_input: { file_path: 'src/core/compact.ts' },
      },
      [
        {
          on: 'PreToolUse',
          when: { tool: 'Write|Edit|MultiEdit', path: 'src/core/**' },
          inject: { text: 'core is zero-dep' },
        },
      ],
    );
    expect(result).not.toBeNull();
    expect(result.hookSpecificOutput.hookEventName).toBe('PreToolUse');
    expect(result.hookSpecificOutput.additionalContext).toContain('core is zero-dep');
  });

  test('no injection when file is outside the rule path glob', () => {
    const result = runHook(
      {
        hook_event_name: 'PreToolUse',
        tool_name: 'Read',
        tool_input: { file_path: 'src/core/compact.ts' },
      },
      [
        {
          on: 'PreToolUse',
          when: { tool: 'Read', path: 'src/stages/**' },
          inject: { text: 'stages only' },
        },
      ],
    );
    expect(result).toBeNull();
  });

  test('emits stderr warning on invalid JSON config', () => {
    const result = runHookRaw(
      { hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: 'src/foo.ts' } },
      '{ broken json',
    );
    expect(result.stderr).toContain('context-rules.json');
    expect(result.stdout.trim()).toBe('');
  });

  test('emits stderr warning when config is not an array', () => {
    const result = runHookRaw(
      { hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: 'src/foo.ts' } },
      '{"not": "array"}',
    );
    expect(result.stderr).toContain('array');
    expect(result.stdout.trim()).toBe('');
  });

  test('ignores inject.shell rules with stderr warning', () => {
    const result = runHookRaw(
      { hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: 'src/foo.ts' } },
      JSON.stringify([
        { on: 'PreToolUse', when: { tool: 'Read' }, inject: { shell: 'echo secret' } },
      ]),
    );
    expect(result.stderr).toContain('shell');
    expect(result.stdout.trim()).toBe('');
  });
});
