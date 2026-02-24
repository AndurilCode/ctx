import { describe, expect, test } from 'bun:test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sectionsCommand } from '../../src/cli/commands/sections.js';

type SectionsRunInput = Parameters<NonNullable<typeof sectionsCommand.run>>[0];

describe('sections command', () => {
  test('lists headings with depth and token counts', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'compact-md-'));
    const inputPath = join(dir, 'input.md');

    await writeFile(
      inputPath,
      [
        '# Intro',
        '',
        'overview paragraph',
        '',
        '# Architecture',
        '',
        'system overview',
        '',
        '## Parsing Layer',
        '',
        'parser details about the system',
        '',
        '# Roadmap',
        '',
        'future work items',
        '',
      ].join('\n'),
      'utf8',
    );

    const lines: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string) => {
      lines.push(chunk);
      return true;
    }) as typeof process.stdout.write;

    const run = sectionsCommand.run;
    if (!run) throw new Error('sections command must define run');

    try {
      await run({
        args: { input: inputPath },
      } as unknown as SectionsRunInput);
    } finally {
      process.stdout.write = origWrite;
    }

    const output = lines.join('');
    expect(output).toContain('# Intro');
    expect(output).toContain('# Architecture');
    expect(output).toContain('## Parsing Layer');
    expect(output).toContain('# Roadmap');
    expect(output).toMatch(/\d+ tokens/);
  });
});
