import { describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const CLI = resolve(import.meta.dirname, '../../src/cli/index.ts');
const BUN = process.execPath;

function run(code: string, args: string[] = []): { stdout: string; stderr: string; status: number } {
  try {
    const stdout = execFileSync(BUN, [CLI, 'exec', code, ...args], {
      encoding: 'utf8',
      timeout: 30000,
      cwd: resolve(import.meta.dirname, '../..'),
    });
    return { stdout, stderr: '', status: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return { stdout: e.stdout ?? '', stderr: e.stderr ?? '', status: e.status ?? 1 };
  }
}

describe('ctx exec CLI', () => {
  test('pipe code via stdin and get stdout', () => {
    const { stdout, status } = run('log("hello from exec")');
    expect(status).toBe(0);
    expect(stdout.trim()).toBe('hello from exec');
  });

  test('error exit code on failure', () => {
    const { status, stderr } = run('throw new Error("boom")');
    expect(status).not.toBe(0);
    expect(stderr).toContain('boom');
  });

  test('tree call works in exec', () => {
    const { stdout, status } = run('const t = await tree({ depth: 0 }); log(t.totalFiles)');
    expect(status).toBe(0);
    expect(Number(stdout.trim())).toBeGreaterThan(0);
  });

  test('--allow-write flag enables patch (error on bad input, not gating error)', () => {
    const { stderr } = run('await patch({ file: "nonexistent.ts", symbol: "x", body: "y" })', [
      '--allow-write',
    ]);
    // Should NOT contain the gating error about --allow-write
    expect(stderr).not.toContain('--allow-write');
  });

  test('patch without --allow-write is rejected', () => {
    const { stderr, status } = run('await patch({})');
    expect(status).not.toBe(0);
    expect(stderr).toContain('--allow-write');
  });
});
