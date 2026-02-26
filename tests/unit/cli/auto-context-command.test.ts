import { describe, expect, test } from 'bun:test';
import { autoContextCommand } from '../../../src/cli/commands/auto-context.js';

type AutoContextRunInput = Parameters<NonNullable<typeof autoContextCommand.run>>[0];

describe('auto-context command', () => {
  test('writes output when --maxTokens argument is provided', async () => {
    const run = autoContextCommand.run;
    if (!run) {
      throw new Error('auto-context command must define a run handler.');
    }

    let stdout = '';
    let stderr = '';
    const originalStdoutWrite = process.stdout.write.bind(process.stdout);
    const originalStderrWrite = process.stderr.write.bind(process.stderr);

    process.stdout.write = ((chunk: unknown) => {
      stdout += String(chunk);
      return true;
    }) as typeof process.stdout.write;
    process.stderr.write = ((chunk: unknown) => {
      stderr += String(chunk);
      return true;
    }) as typeof process.stderr.write;

    try {
      await run({
        args: {
          query: 'compact',
          maxTokens: '700',
          path: undefined,
          seeds: undefined,
          depth: '0',
          glob: undefined,
          maxFiles: '5',
          _: ['compact'],
        },
      } as unknown as AutoContextRunInput);
    } finally {
      process.stdout.write = originalStdoutWrite;
      process.stderr.write = originalStderrWrite;
    }

    expect(stdout).toContain('## ');
    const meta = JSON.parse(stderr) as { budget: number; selectedFiles: Array<{ file: string }> };
    expect(meta.budget).toBe(700);
    expect(meta.selectedFiles.length).toBeGreaterThan(0);
  });
});
