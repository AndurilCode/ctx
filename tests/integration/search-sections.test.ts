import { describe, expect, test } from 'bun:test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { searchSectionsCommand } from '../../src/cli/commands/search-sections.js';

type SearchSectionsRunInput = Parameters<NonNullable<typeof searchSectionsCommand.run>>[0];

function makeArgs(query: string, files: string[]): SearchSectionsRunInput {
  return { args: { query, _: [query, ...files] } } as unknown as SearchSectionsRunInput;
}

async function captureStdout(fn: () => Promise<void>): Promise<string> {
  const chunks: string[] = [];
  const origWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: string) => {
    chunks.push(chunk);
    return true;
  }) as typeof process.stdout.write;
  try {
    await fn();
  } finally {
    process.stdout.write = origWrite;
  }
  return chunks.join('');
}

describe('search-sections command', () => {
  test('finds matching sections across a single file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'compact-md-'));
    const file = join(dir, 'doc.md');

    await writeFile(
      file,
      [
        '# Authentication',
        '',
        'Details about auth.',
        '',
        '## OAuth Flow',
        '',
        'OAuth steps here.',
        '',
        '# Deployment',
        '',
        'Deploy details.',
        '',
      ].join('\n'),
      'utf8',
    );

    const run = searchSectionsCommand.run;
    if (!run) throw new Error('search-sections command must define run');

    const output = await captureStdout(() => run(makeArgs('oauth', [file])));

    expect(output).toContain('## OAuth Flow');
    expect(output).toContain('tokens');
    expect(output).not.toContain('# Authentication');
    expect(output).not.toContain('# Deployment');
  });

  test('search is case-insensitive', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'compact-md-'));
    const file = join(dir, 'doc.md');

    await writeFile(file, '# Getting Started\n\nContent.\n', 'utf8');

    const run = searchSectionsCommand.run;
    if (!run) throw new Error('search-sections command must define run');

    const output = await captureStdout(() => run(makeArgs('getting started', [file])));

    expect(output).toContain('# Getting Started');
  });

  test('reports no matches when query is absent', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'compact-md-'));
    const file = join(dir, 'doc.md');

    await writeFile(file, '# Introduction\n\nText.\n', 'utf8');

    const run = searchSectionsCommand.run;
    if (!run) throw new Error('search-sections command must define run');

    const output = await captureStdout(() => run(makeArgs('zzznomatch', [file])));

    expect(output).toContain('No sections matching');
    expect(output).toContain('zzznomatch');
  });

  test('searches across multiple files and groups results by file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'compact-md-'));
    const fileA = join(dir, 'a.md');
    const fileB = join(dir, 'b.md');

    await writeFile(fileA, '# Middleware Setup\n\nDetails.\n', 'utf8');
    await writeFile(fileB, '# API Overview\n\n## Middleware Hooks\n\nHooks.\n', 'utf8');

    const run = searchSectionsCommand.run;
    if (!run) throw new Error('search-sections command must define run');

    const output = await captureStdout(() => run(makeArgs('middleware', [fileA, fileB])));

    expect(output).toContain(fileA);
    expect(output).toContain(fileB);
    expect(output).toContain('# Middleware Setup');
    expect(output).toContain('## Middleware Hooks');
  });

  test('skips unreadable files and continues', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'compact-md-'));
    const goodFile = join(dir, 'good.md');
    const badFile = join(dir, 'nonexistent.md');

    await writeFile(goodFile, '# Testing Guide\n\nContent.\n', 'utf8');

    const run = searchSectionsCommand.run;
    if (!run) throw new Error('search-sections command must define run');

    const stderrChunks: string[] = [];
    const origStderrWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string) => {
      stderrChunks.push(chunk);
      return true;
    }) as typeof process.stderr.write;

    let output: string;
    try {
      output = await captureStdout(() => run(makeArgs('testing', [badFile, goodFile])));
    } finally {
      process.stderr.write = origStderrWrite;
    }

    expect(stderrChunks.join('')).toContain('warning');
    expect(output).toContain('# Testing Guide');
  });
});
