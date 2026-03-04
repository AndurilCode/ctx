import { describe, expect, test } from 'bun:test';
import { runHook } from './rules-to-hook-events.test';

// ── when.content ──────────────────────────────────────────────────────

describe('when.content matcher', () => {
  test('PreToolUse Write + when.content matches content field', () => {
    const raw = runHook(
      { hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: 'foo.js', content: 'console.log("debug")' } },
      [{ on: 'PreToolUse', when: { tool: 'Write', content: 'console\\.log' }, inject: { text: 'No console.log allowed' } }],
    );
    const output = JSON.parse(raw);
    expect(output.hookSpecificOutput.additionalContext).toBe('No console.log allowed');
  });

  test('PreToolUse Edit + when.content matches new_string field', () => {
    const raw = runHook(
      { hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: 'foo.ts', new_string: '// TODO: fix later' } },
      [{ on: 'PreToolUse', when: { tool: 'Edit', content: 'TODO' }, inject: { text: 'No TODOs in code' } }],
    );
    const output = JSON.parse(raw);
    expect(output.hookSpecificOutput.additionalContext).toBe('No TODOs in code');
  });

  test('Content mismatch produces no output', () => {
    const raw = runHook(
      { hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: 'foo.js', content: 'const x = 1;' } },
      [{ on: 'PreToolUse', when: { tool: 'Write', content: 'console\\.log' }, inject: { text: 'No console.log' } }],
    );
    expect(raw).toBe('');
  });
});

// ── when.response ─────────────────────────────────────────────────────

describe('when.response matcher', () => {
  test('PostToolUse + when.response matches stringified tool_response', () => {
    const raw = runHook(
      { hook_event_name: 'PostToolUse', tool_name: 'Read', tool_response: 'Error: ENOENT: no such file' },
      [{ on: 'PostToolUse', when: { response: 'ENOENT' }, inject: { text: 'File not found' } }],
    );
    const output = JSON.parse(raw);
    expect(output.hookSpecificOutput.additionalContext).toBe('File not found');
  });

  test('Response mismatch produces no output', () => {
    const raw = runHook(
      { hook_event_name: 'PostToolUse', tool_name: 'Read', tool_response: 'file contents here' },
      [{ on: 'PostToolUse', when: { response: 'ENOENT' }, inject: { text: 'File not found' } }],
    );
    expect(raw).toBe('');
  });
});

// ── Stop events ───────────────────────────────────────────────────────

describe('Stop events', () => {
  test('Stop + block produces decision:block with no hookSpecificOutput', () => {
    const raw = runHook(
      { hook_event_name: 'Stop' },
      [{ on: 'Stop', inject: { block: 'Continue working on the task' } }],
    );
    const output = JSON.parse(raw);
    expect(output.decision).toBe('block');
    expect(output.reason).toBe('Continue working on the task');
    expect(output.hookSpecificOutput).toBeUndefined();
  });

  test('Stop with stop_hook_active=true produces empty output (safety guard)', () => {
    const raw = runHook(
      { hook_event_name: 'Stop', stop_hook_active: true },
      [{ on: 'Stop', inject: { block: 'Continue working' } }],
    );
    expect(raw).toBe('');
  });

  test('Stop with stop_hook_active=false allows block rule to fire', () => {
    const raw = runHook(
      { hook_event_name: 'Stop', stop_hook_active: false },
      [{ on: 'Stop', inject: { block: 'Keep going' } }],
    );
    const output = JSON.parse(raw);
    expect(output.decision).toBe('block');
    expect(output.reason).toBe('Keep going');
  });
});

// ── Block on non-PreToolUse ───────────────────────────────────────────

describe('block on non-PreToolUse events', () => {
  test('PostToolUse block produces decision:block with hookSpecificOutput', () => {
    const raw = runHook(
      { hook_event_name: 'PostToolUse', tool_name: 'Read', tool_input: { file_path: 'secret.env' } },
      [
        { on: 'PostToolUse', when: { tool: 'Read', path: '*.env' }, inject: { block: 'Sensitive file detected' } },
        { on: 'PostToolUse', when: { tool: 'Read' }, inject: { text: 'Read completed' } },
      ],
    );
    const output = JSON.parse(raw);
    expect(output.decision).toBe('block');
    expect(output.reason).toBe('Sensitive file detected');
    expect(output.hookSpecificOutput.additionalContext).toBe('Read completed');
  });

  test('PreToolUse block still produces permissionDecision deny (backward compat)', () => {
    const raw = runHook(
      { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'rm -rf /' } },
      [{ on: 'PreToolUse', when: { tool: 'Bash', command: 'rm' }, inject: { block: 'Blocked' } }],
    );
    const output = JSON.parse(raw);
    expect(output.hookSpecificOutput.permissionDecision).toBe('deny');
    expect(output.hookSpecificOutput.permissionDecisionReason).toBe('Blocked');
    expect(output.decision).toBeUndefined();
  });

  test('allow on non-PreToolUse events is still ignored', () => {
    const raw = runHook(
      { hook_event_name: 'PostToolUse', tool_name: 'Read', tool_input: { file_path: 'src/foo.ts' } },
      [{ on: 'PostToolUse', when: { tool: 'Read' }, inject: { allow: 'Should be ignored.' } }],
    );
    expect(raw).toBe('');
  });
});
