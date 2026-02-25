import { describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compactCommand } from '../../src/cli/commands/compact.js';
import { diffCommand } from '../../src/cli/commands/diff.js';
import { expandCommand } from '../../src/cli/commands/expand.js';

type CompactRunInput = Parameters<NonNullable<typeof compactCommand.run>>[0];
type DiffRunInput = Parameters<NonNullable<typeof diffCommand.run>>[0];
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
        versionMarker: false,
        noVersionMarker: false,
      },
    } as CompactRunInput);

    const compactText = await readFile(compactPath, 'utf8');
    expect(compactText).toContain('# Title');
    expect(compactText).not.toContain('%compact.md:1');

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

  test('pack supports section-only filtering', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'compact-md-'));
    const inputPath = join(dir, 'input.md');
    const compactPath = join(dir, 'output.cmd');

    await writeFile(
      inputPath,
      ['# Intro', '', 'overview', '', '# Architecture', '', 'system details', ''].join('\n'),
      'utf8',
    );

    const runCompact = compactCommand.run;
    if (!runCompact) {
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
        versionMarker: false,
        noVersionMarker: false,
        only: ['architecture'],
        strip: undefined,
        unwrap: false,
      },
    } as unknown as CompactRunInput);

    const compactText = await readFile(compactPath, 'utf8');
    expect(compactText).toContain('# Architecture');
    expect(compactText).not.toContain('# Intro');
  });

  test('diff command compacts unified diffs', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'compact-md-'));
    const inputPath = join(dir, 'input.diff');
    const outputPath = join(dir, 'output.diff');
    await writeFile(
      inputPath,
      [
        'diff --git a/src/app.ts b/src/app.ts',
        'index 1..2 100644',
        '--- a/src/app.ts',
        '+++ b/src/app.ts',
        '@@ -1,3 +1,3 @@',
        ' const v = 1;',
        '-const name = old;',
        '+const name = next;',
        ' return v;',
      ].join('\n'),
      'utf8',
    );

    const runDiff = diffCommand.run;
    if (!runDiff) {
      throw new Error('CLI commands must define run handlers.');
    }

    await runDiff({
      args: {
        input: inputPath,
        output: outputPath,
        compactHeaders: true,
        noCompactHeaders: false,
        changesOnly: false,
        context: '1',
      },
    } as DiffRunInput);

    const output = await readFile(outputPath, 'utf8');
    expect(output).toContain('=== src/app.ts');
    expect(output).not.toContain('diff --git');
    expect(output).toContain('-const name = old;');
    expect(output).toContain('+const name = next;');
  });
});
