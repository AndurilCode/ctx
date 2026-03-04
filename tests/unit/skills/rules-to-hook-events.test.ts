import { describe, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ENGINE = resolve(process.cwd(), 'skills/rules-to-hook/engine.mjs');

export function runHook(payload: unknown, rules: unknown[]): string {
  const workspace = mkdtempSync(join(tmpdir(), 'rules-to-hook-events-'));
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

// ── SessionStart ──────────────────────────────────────────────────────

describe('SessionStart events', () => {
  test('SessionStart + when.source matches source field', () => {
    const raw = runHook(
      { hook_event_name: 'SessionStart', source: 'startup' },
      [{ on: 'SessionStart', when: { source: 'startup' }, inject: { text: 'Welcome context' } }],
    );
    const output = JSON.parse(raw);
    expect(output.hookSpecificOutput.additionalContext).toBe('Welcome context');
  });

  test('SessionStart source mismatch produces no output', () => {
    const raw = runHook(
      { hook_event_name: 'SessionStart', source: 'resume' },
      [{ on: 'SessionStart', when: { source: 'startup' }, inject: { text: 'Welcome context' } }],
    );
    expect(raw).toBe('');
  });

  test('SessionStart with no when fires unconditionally', () => {
    const raw = runHook(
      { hook_event_name: 'SessionStart' },
      [{ on: 'SessionStart', inject: { text: 'Always inject' } }],
    );
    const output = JSON.parse(raw);
    expect(output.hookSpecificOutput.additionalContext).toBe('Always inject');
  });
});

// ── SubagentStart ─────────────────────────────────────────────────────

describe('SubagentStart events', () => {
  test('SubagentStart + when.agent_type matches agent_type field', () => {
    const raw = runHook(
      { hook_event_name: 'SubagentStart', agent_type: 'code' },
      [{ on: 'SubagentStart', when: { agent_type: 'code' }, inject: { text: 'Code agent context' } }],
    );
    const output = JSON.parse(raw);
    expect(output.hookSpecificOutput.additionalContext).toBe('Code agent context');
  });

  test('SubagentStart agent_type mismatch produces no output', () => {
    const raw = runHook(
      { hook_event_name: 'SubagentStart', agent_type: 'research' },
      [{ on: 'SubagentStart', when: { agent_type: 'code' }, inject: { text: 'Code agent context' } }],
    );
    expect(raw).toBe('');
  });

  test('SubagentStart pipe-separated agent_type matches any alternative', () => {
    const raw = runHook(
      { hook_event_name: 'SubagentStart', agent_type: 'research' },
      [{ on: 'SubagentStart', when: { agent_type: 'code|research' }, inject: { text: 'Agent context' } }],
    );
    const output = JSON.parse(raw);
    expect(output.hookSpecificOutput.additionalContext).toBe('Agent context');
  });
});

// ── PostToolUseFailure ────────────────────────────────────────────────

describe('PostToolUseFailure events', () => {
  test('PostToolUseFailure + when.error matches error field', () => {
    const raw = runHook(
      { hook_event_name: 'PostToolUseFailure', tool_name: 'Bash', error: 'npm ERR! missing script' },
      [{ on: 'PostToolUseFailure', when: { error: 'npm' }, inject: { text: 'Try: npm cache clean' } }],
    );
    const output = JSON.parse(raw);
    expect(output.hookSpecificOutput.additionalContext).toBe('Try: npm cache clean');
  });

  test('PostToolUseFailure combined when.tool + when.error uses AND logic', () => {
    const raw = runHook(
      { hook_event_name: 'PostToolUseFailure', tool_name: 'Bash', error: 'npm ERR!' },
      [{ on: 'PostToolUseFailure', when: { tool: 'Bash', error: 'npm' }, inject: { text: 'npm fix' } }],
    );
    const output = JSON.parse(raw);
    expect(output.hookSpecificOutput.additionalContext).toBe('npm fix');
  });

  test('PostToolUseFailure error mismatch produces no output', () => {
    const raw = runHook(
      { hook_event_name: 'PostToolUseFailure', error: 'ENOENT' },
      [{ on: 'PostToolUseFailure', when: { error: 'npm' }, inject: { text: 'npm fix' } }],
    );
    expect(raw).toBe('');
  });
});
