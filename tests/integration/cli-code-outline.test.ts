import { describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { codeOutlineCommand } from '../../src/cli/commands/code-outline.js';

type OutlineRunInput = Parameters<NonNullable<typeof codeOutlineCommand.run>>[0];

describe('cli code-outline', () => {
  test('writes outline output to file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ctx-outline-'));
    const inputPath = join(dir, 'sample.ts');
    const outputPath = join(dir, 'outline.txt');
    await writeFile(
      inputPath,
      [
        "import { readFile } from 'node:fs/promises';",
        '',
        'export function parse(input: string): string {',
        '  return input.trim();',
        '}',
        '',
      ].join('\n'),
      'utf8',
    );

    const runOutline = codeOutlineCommand.run;
    if (!runOutline) throw new Error('CLI command must define run handler.');

    await runOutline({
      args: {
        input: inputPath,
        output: outputPath,
        'collapse-imports': true,
      },
    } as OutlineRunInput);

    const output = await readFile(outputPath, 'utf8');
    expect(output).toContain('Imports:');
    expect(output).toContain('Functions:');
    expect(output).toContain('parse');
  });
});
