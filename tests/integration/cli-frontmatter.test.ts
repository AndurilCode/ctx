import { describe, expect, test } from 'bun:test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compactCommand } from '../../src/cli/commands/compact.js';
import { extractCommand } from '../../src/cli/commands/extract.js';
import { sectionsCommand } from '../../src/cli/commands/sections.js';
import { statsCommand } from '../../src/cli/commands/stats.js';

type CompactRunInput = Parameters<NonNullable<typeof compactCommand.run>>[0];
type ExtractRunInput = Parameters<NonNullable<typeof extractCommand.run>>[0];
type SectionsRunInput = Parameters<NonNullable<typeof sectionsCommand.run>>[0];
type StatsRunInput = Parameters<NonNullable<typeof statsCommand.run>>[0];

const markdownWithFrontmatter = [
  '---',
  'title: Compact Docs',
  'count: 3',
  'enabled: true',
  '---',
  '# Intro',
  '',
  'Body text.',
  '',
].join('\n');

function captureStdout(fn: () => Promise<void>): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string) => {
      chunks.push(chunk);
      return true;
    }) as typeof process.stdout.write;
    fn()
      .then(() => {
        process.stdout.write = orig;
        resolve(chunks.join(''));
      })
      .catch((err) => {
        process.stdout.write = orig;
        reject(err);
      });
  });
}

function captureStderr(fn: () => Promise<void>): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: string[] = [];
    const orig = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string) => {
      chunks.push(chunk);
      return true;
    }) as typeof process.stderr.write;
    fn()
      .then(() => {
        process.stderr.write = orig;
        resolve(chunks.join(''));
      })
      .catch((err) => {
        process.stderr.write = orig;
        reject(err);
      });
  });
}

describe('cli frontmatter', () => {
  test('sections prints frontmatter before TOC when present', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'compact-md-cli-fm-'));
    const filePath = join(dir, 'input.md');
    await writeFile(filePath, markdownWithFrontmatter);

    const run = sectionsCommand.run;
    if (!run) throw new Error('sections command must define run');

    const output = await captureStdout(() =>
      run({ args: { input: filePath } } as unknown as SectionsRunInput),
    );

    expect(output).toContain('"title"');
    expect(output).toContain('"Compact Docs"');
    expect(output).toContain('# Intro');
    const frontmatterIndex = output.indexOf('"title"');
    const sectionIndex = output.indexOf('# Intro');
    expect(frontmatterIndex).toBeLessThan(sectionIndex);
  });

  test('sections omits frontmatter block when absent', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'compact-md-cli-fm-'));
    const filePath = join(dir, 'input.md');
    await writeFile(filePath, '# Intro\n\nBody\n');

    const run = sectionsCommand.run;
    if (!run) throw new Error('sections command must define run');

    const output = await captureStdout(() =>
      run({ args: { input: filePath } } as unknown as SectionsRunInput),
    );

    expect(output).not.toContain('[frontmatter]');
    expect(output).toContain('# Intro');
  });

  test('stats JSON includes frontmatter key', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'compact-md-cli-fm-'));
    const filePath = join(dir, 'input.md');
    await writeFile(filePath, markdownWithFrontmatter);

    const run = statsCommand.run;
    if (!run) throw new Error('stats command must define run');

    const output = await captureStdout(() =>
      run({
        args: {
          input: filePath,
          dedup: false,
          semantic: false,
          keepComments: false,
          unwrap: false,
          tableDelimiter: ',',
        },
      } as unknown as StatsRunInput),
    );

    const parsed = JSON.parse(output) as { frontmatter?: Record<string, unknown> };
    expect(parsed.frontmatter).toEqual({ title: 'Compact Docs', count: 3, enabled: true });
  });

  test('pack writes frontmatter to stderr when present', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'compact-md-cli-fm-'));
    const inputPath = join(dir, 'input.md');
    const outputPath = join(dir, 'output.cmd');
    await writeFile(inputPath, markdownWithFrontmatter);

    const run = compactCommand.run;
    if (!run) throw new Error('compact command must define run');

    const stderr = await captureStderr(() =>
      run({
        args: {
          input: inputPath,
          output: outputPath,
          dedup: false,
          semantic: false,
          keepComments: false,
          stats: false,
          tableDelimiter: ',',
          versionMarker: false,
          noVersionMarker: false,
        },
      } as unknown as CompactRunInput),
    );

    expect(stderr).toContain('"title"');
    expect(stderr).toContain('"Compact Docs"');
  });

  test('pack does not write frontmatter to stderr when absent', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'compact-md-cli-fm-'));
    const inputPath = join(dir, 'input.md');
    const outputPath = join(dir, 'output.cmd');
    await writeFile(inputPath, '# Title\n\nNo frontmatter.\n');

    const run = compactCommand.run;
    if (!run) throw new Error('compact command must define run');

    const stderr = await captureStderr(() =>
      run({
        args: {
          input: inputPath,
          output: outputPath,
          dedup: false,
          semantic: false,
          keepComments: false,
          stats: false,
          tableDelimiter: ',',
          versionMarker: false,
          noVersionMarker: false,
        },
      } as unknown as CompactRunInput),
    );

    expect(stderr).toBe('');
  });

  test('extract writes frontmatter to stderr when present', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'compact-md-cli-fm-'));
    const inputPath = join(dir, 'input.md');
    const outputPath = join(dir, 'output.md');
    await writeFile(inputPath, markdownWithFrontmatter);

    const run = extractCommand.run;
    if (!run) throw new Error('extract command must define run');

    const stderr = await captureStderr(() =>
      run({
        args: {
          input: inputPath,
          output: outputPath,
          maxChars: '200',
          maxListItems: '3',
          maxTableRows: '2',
        },
      } as unknown as ExtractRunInput),
    );

    expect(stderr).toContain('"title"');
    expect(stderr).toContain('"Compact Docs"');
  });
});
