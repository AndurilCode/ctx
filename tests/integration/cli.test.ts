import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { compactCommand } from '../../src/cli/commands/compact.js';
import { expandCommand } from '../../src/cli/commands/expand.js';

type CompactRunInput = Parameters<NonNullable<typeof compactCommand.run>>[0];
type ExpandRunInput = Parameters<NonNullable<typeof expandCommand.run>>[0];

describe('cli integration', () => {
  test('pack then unpack from files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'compact-md-'));
    const inputPath = join(dir, 'input.md');
    const compactPath = join(dir, 'output.cmd');
    const restoredPath = join(dir, 'restored.md');

    await writeFile(inputPath, '# Title\n\n- [ ] todo\n', 'utf8');

    const runCompact = compactCommand.run;
    const runExpand = expandCommand.run;
    if (!runCompact || !runExpand) {
      throw new Error('CLI commands must define run handlers.');
    }

    await runCompact({
      args: {
        input: inputPath,
        output: compactPath,
        dedup: false,
        semantic: false,
        keepComments: false,
        stats: false,
        tableDelimiter: ',',
        noVersionMarker: false,
      },
    } as CompactRunInput);

    const compactText = await readFile(compactPath, 'utf8');
    expect(compactText).toContain(':1 Title');

    await runExpand({
      args: {
        input: compactPath,
        output: restoredPath,
        tableDelimiter: ',',
      },
    } as ExpandRunInput);

    const restored = await readFile(restoredPath, 'utf8');
    expect(restored).toContain('# Title');
    expect(restored).toContain('- [ ] todo');
  });
});
