import { describe, expect, test } from 'bun:test';
import { reviewCommand } from '../../../src/cli/commands/review.js';

type ReviewRunInput = Parameters<NonNullable<typeof reviewCommand.run>>[0];

describe('review command', () => {
  test('writes JSON review report to stdout', async () => {
    const run = reviewCommand.run;
    if (!run) {
      throw new Error('review command must define a run handler.');
    }

    let stdout = '';
    const originalStdoutWrite = process.stdout.write.bind(process.stdout);

    process.stdout.write = ((chunk: unknown) => {
      stdout += String(chunk);
      return true;
    }) as typeof process.stdout.write;

    try {
      await run({
        args: {
          query: 'lock cache',
          path: undefined,
          glob: 'src/utils/*cache.ts',
          maxResults: '2',
          pass1Tokens: '200',
          pass2Tokens: '800',
          maxPass2Files: '1',
          riskTerms: 'withcachelock',
          _: ['lock cache'],
        },
      } as unknown as ReviewRunInput);
    } finally {
      process.stdout.write = originalStdoutWrite;
    }

    const parsed = JSON.parse(stdout) as { files: Array<{ file: string }>; totals: { fullTokens: number } };
    expect(parsed.files.length).toBeGreaterThan(0);
    expect(parsed.totals.fullTokens).toBeGreaterThan(0);
  });
});
