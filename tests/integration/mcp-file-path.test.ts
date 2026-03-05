import { describe, expect, test } from 'bun:test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compact } from '../../src/core/compact.js';
import { runDiffTool } from '../../src/mcp/tools/diff.js';
import { runPackTool } from '../../src/mcp/tools/pack.js';
import { runPruneLogTool } from '../../src/mcp/tools/prune-log.js';
import { runSectionsTool } from '../../src/mcp/tools/sections.js';

describe('mcp tools file path support', () => {
  test('ctx_compact reads from file when file param provided', async () => {
    const markdown = '# Title\n\nParagraph text.\n';
    const dir = await mkdtemp(join(tmpdir(), 'ctx-test-'));
    const filePath = join(dir, 'test.md');
    await writeFile(filePath, markdown);

    const result = await runPackTool({ file: filePath });
    const output = (result.content[0] as { text: string }).text;
    expect(output).toBe(compact(markdown).output);
  });

  test('ctx_sections reads from file when file param provided', async () => {
    const markdown = '# Intro\n\nhello\n\n## Child\n\nworld\n';
    const dir = await mkdtemp(join(tmpdir(), 'ctx-test-'));
    const filePath = join(dir, 'test.md');
    await writeFile(filePath, markdown);

    const result = await runSectionsTool({ file: filePath });
    const output = (result.content[0] as { text: string }).text;
    expect(output).toContain('# Intro');
    expect(output).toContain('## Child');
  });

  test('ctx_changes reads from file when file param provided', async () => {
    const diff = [
      'diff --git a/src/app.ts b/src/app.ts',
      'index 1..2 100644',
      '--- a/src/app.ts',
      '+++ b/src/app.ts',
      '@@ -1 +1 @@',
      '-old',
      '+new',
    ].join('\n');
    const dir = await mkdtemp(join(tmpdir(), 'ctx-test-'));
    const filePath = join(dir, 'test.diff');
    await writeFile(filePath, diff);

    const result = await runDiffTool({ file: filePath });
    const output = (result.content[0] as { text: string }).text;
    expect(output).toContain('=== src/app.ts');
    expect(output).toContain('-old');
    expect(output).toContain('+new');
  });

  test('ctx_prune reads from file when file param provided', async () => {
    const log = ['2026-02-25T10:00:00Z info line', '2026-02-25T10:00:01Z info line'].join('\n');
    const dir = await mkdtemp(join(tmpdir(), 'ctx-test-'));
    const filePath = join(dir, 'test.log');
    await writeFile(filePath, log);

    const result = await runPruneLogTool({ file: filePath, stripTimestamps: 'strip', allowTokenExpansion: true });
    const parsed = JSON.parse((result.content[0] as { text: string }).text) as { output: string };
    expect(parsed.output).toContain('[timestamps stripped: iso]');
    expect(parsed.output).not.toContain('2026-02-25T10:00:01Z');
  });

  test('pack tool throws when neither markdown nor file provided', async () => {
    await expect(runPackTool({} as { markdown: string })).rejects.toThrow(/markdown.*file/i);
  });

  test('diff tool throws when neither diff nor file provided', async () => {
    await expect(runDiffTool({})).rejects.toThrow(/diff.*file/i);
  });

  test('prune-log tool throws when neither log nor file provided', async () => {
    await expect(runPruneLogTool({})).rejects.toThrow(/log.*file/i);
  });
});
