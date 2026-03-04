import { describe, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const LEARN = resolve(process.cwd(), 'skills/rules-to-hook/learn.mjs');

function runLearn(args: string[], workspace: string): string {
  return execFileSync('node', [LEARN, ...args], {
    cwd: workspace,
    encoding: 'utf8',
  }).trim();
}

function makeWorkspace(learnings?: unknown[]): string {
  const ws = mkdtempSync(join(tmpdir(), 'learn-cli-'));
  mkdirSync(join(ws, '.claude'), { recursive: true });
  if (learnings) {
    writeFileSync(
      join(ws, '.claude/learnings.json'),
      JSON.stringify(learnings, null, 2),
    );
  }
  return ws;
}

function readLearnings(workspace: string): unknown[] {
  return JSON.parse(readFileSync(join(workspace, '.claude/learnings.json'), 'utf8'));
}

describe('learn.mjs CLI', () => {
  test('add creates learnings.json and adds entry', () => {
    const ws = makeWorkspace();
    const out = runLearn(
      ['add', '--files', 'src/stages/**', '--learning', 'Use AST nodes only'],
      ws,
    );

    const entries = readLearnings(ws);
    expect(entries).toHaveLength(1);
    expect((entries[0] as any).files).toEqual(['src/stages/**']);
    expect((entries[0] as any).learning).toBe('Use AST nodes only');
    expect((entries[0] as any).timestamp).toBeDefined();
    expect(out).toContain('Added learning');
    rmSync(ws, { recursive: true, force: true });
  });

  test('add shows overlapping existing learnings', () => {
    const ws = makeWorkspace([
      {
        files: ['src/stages/**'],
        learning: 'Existing stage insight',
        timestamp: '2026-03-04T10:00:00Z',
      },
    ]);

    const out = runLearn(
      ['add', '--files', 'src/stages/elision.ts', '--learning', 'Elision uses thresholds'],
      ws,
    );

    expect(out).toContain('Existing stage insight');
    expect(out).toContain('Added learning');
    const entries = readLearnings(ws);
    expect(entries).toHaveLength(2);
    rmSync(ws, { recursive: true, force: true });
  });

  test('add with multiple --files globs', () => {
    const ws = makeWorkspace();
    runLearn(
      ['add', '--files', 'src/core/**,src/stages/**', '--learning', 'Cross-cutting concern'],
      ws,
    );

    const entries = readLearnings(ws);
    expect(entries).toHaveLength(1);
    expect((entries[0] as any).files).toEqual(['src/core/**', 'src/stages/**']);
    rmSync(ws, { recursive: true, force: true });
  });

  test('list shows all learnings', () => {
    const ws = makeWorkspace([
      {
        files: ['src/stages/**'],
        learning: 'Stage insight',
        timestamp: '2026-03-04T10:00:00Z',
      },
      {
        files: ['src/core/**'],
        learning: 'Core insight',
        timestamp: '2026-03-04T11:00:00Z',
      },
    ]);

    const out = runLearn(['list'], ws);
    expect(out).toContain('[0]');
    expect(out).toContain('Stage insight');
    expect(out).toContain('[1]');
    expect(out).toContain('Core insight');
    rmSync(ws, { recursive: true, force: true });
  });

  test('list filters by --files', () => {
    const ws = makeWorkspace([
      {
        files: ['src/stages/**'],
        learning: 'Stage insight',
        timestamp: '2026-03-04T10:00:00Z',
      },
      {
        files: ['src/core/**'],
        learning: 'Core insight',
        timestamp: '2026-03-04T11:00:00Z',
      },
    ]);

    const out = runLearn(['list', '--files', 'src/stages/elision.ts'], ws);
    expect(out).toContain('Stage insight');
    expect(out).not.toContain('Core insight');
    rmSync(ws, { recursive: true, force: true });
  });

  test('remove deletes entry by index', () => {
    const ws = makeWorkspace([
      {
        files: ['src/stages/**'],
        learning: 'Stage insight',
        timestamp: '2026-03-04T10:00:00Z',
      },
      {
        files: ['src/core/**'],
        learning: 'Core insight',
        timestamp: '2026-03-04T11:00:00Z',
      },
    ]);

    runLearn(['remove', '--index', '0'], ws);
    const entries = readLearnings(ws);
    expect(entries).toHaveLength(1);
    expect((entries[0] as any).learning).toBe('Core insight');
    rmSync(ws, { recursive: true, force: true });
  });

  test('update replaces learning text at index', () => {
    const ws = makeWorkspace([
      {
        files: ['src/stages/**'],
        learning: 'Old insight',
        timestamp: '2026-03-04T10:00:00Z',
      },
    ]);

    runLearn(['update', '--index', '0', '--learning', 'New insight'], ws);
    const entries = readLearnings(ws);
    expect(entries).toHaveLength(1);
    expect((entries[0] as any).learning).toBe('New insight');
    rmSync(ws, { recursive: true, force: true });
  });

  test('list on empty/missing file shows no learnings', () => {
    const ws = makeWorkspace();
    const out = runLearn(['list'], ws);
    expect(out).toContain('No learnings');
    rmSync(ws, { recursive: true, force: true });
  });
});
