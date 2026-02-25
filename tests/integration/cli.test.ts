import { describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compactCommand } from '../../src/cli/commands/compact.js';
import { diffCommand } from '../../src/cli/commands/diff.js';
import { expandCommand } from '../../src/cli/commands/expand.js';
import { pruneLogCommand } from '../../src/cli/commands/prune-log.js';

type CompactRunInput = Parameters<NonNullable<typeof compactCommand.run>>[0];
type DiffRunInput = Parameters<NonNullable<typeof diffCommand.run>>[0];
type ExpandRunInput = Parameters<NonNullable<typeof expandCommand.run>>[0];
type PruneLogRunInput = Parameters<NonNullable<typeof pruneLogCommand.run>>[0];

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

  test('prune-log command reduces noisy test output', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'compact-md-'));
    const inputPath = join(dir, 'input.log');
    const outputPath = join(dir, 'output.log');

    await writeFile(
      inputPath,
      ['✓ test one [3ms]', '✓ test two [4ms]', '✗ test three [5ms]', 'Tests: 2 passed, 1 failed'].join(
        '\n',
      ),
      'utf8',
    );

    const runPruneLog = pruneLogCommand.run;
    if (!runPruneLog) {
      throw new Error('CLI commands must define run handlers.');
    }

    await runPruneLog({
      args: {
        input: inputPath,
        output: outputPath,
        allowTokenExpansion: true,
        timestamps: 'auto',
        noProgress: false,
        noPassElision: false,
        noRepeatFold: false,
        strip: undefined,
        fold: undefined,
        blockFold: undefined,
        stats: false,
      },
    } as unknown as PruneLogRunInput);

    const output = await readFile(outputPath, 'utf8');
    expect(output).toContain('✗ test three [5ms]');
    expect(output).toContain('[tests pruned: 2 passing stripped, 1 failing kept]');
    expect(output).not.toContain('✓ test one [3ms]');
  });

  test('prune-log runtime profile strips timestamps by default', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'compact-md-'));
    const inputPath = join(dir, 'runtime.log');
    const outputPath = join(dir, 'runtime.out.log');
    await writeFile(
      inputPath,
      ['2026-02-25T10:00:00Z GET /users 200', '2026-02-25T10:00:01Z GET /users 500'].join('\n'),
      'utf8',
    );

    const runPruneLog = pruneLogCommand.run;
    if (!runPruneLog) {
      throw new Error('CLI commands must define run handlers.');
    }

    await runPruneLog({
      args: {
        input: inputPath,
        output: outputPath,
        profile: 'runtime',
        allowTokenExpansion: true,
        stats: false,
      },
    } as unknown as PruneLogRunInput);

    const output = await readFile(outputPath, 'utf8');
    expect(output).toContain('[timestamps stripped: iso]');
    expect(output).not.toContain('2026-02-25T10:00:01Z');
  });

  test('prune-log lint profile folds diagnostics', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'compact-md-'));
    const inputPath = join(dir, 'lint.log');
    const outputPath = join(dir, 'lint.out.log');
    await writeFile(
      inputPath,
      [
        '$ biome check .',
        './src/a.ts format',
        '',
        '  × Formatter would have printed the following content:',
        '',
        '    10 10 │ a',
        '    11 11 │ b',
        '',
      ].join('\n'),
      'utf8',
    );

    const runPruneLog = pruneLogCommand.run;
    if (!runPruneLog) {
      throw new Error('CLI commands must define run handlers.');
    }

    await runPruneLog({
      args: {
        input: inputPath,
        output: outputPath,
        profile: 'lint',
        stats: false,
      },
    } as unknown as PruneLogRunInput);

    const output = await readFile(outputPath, 'utf8');
    expect(output).toContain('[diagnostic');
    expect(output).not.toContain('10 10 │ a');
  });
});
