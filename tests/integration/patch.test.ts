import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { codeOutline } from '../../src/core/code-outline.js';
import { patch } from '../../src/core/patch.js';
import { insert } from '../../src/core/insert.js';
import { rename } from '../../src/core/rename.js';

const SAMPLE = [
  "import { readFile } from 'node:fs/promises';",
  '',
  'export function loadConfig(path: string): Config {',
  '  const raw = readFile(path, "utf8");',
  '  return JSON.parse(raw);',
  '}',
  '',
  'export function saveConfig(path: string, config: Config): void {',
  '  const data = JSON.stringify(config);',
  '  writeFile(path, data);',
  '}',
  '',
].join('\n');

describe('full read-patch-verify cycle', () => {
  let tempDir: string;
  let filePath: string;

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });

  async function setup() {
    tempDir = await mkdtemp(join(tmpdir(), 'ctx-integration-'));
    filePath = join(tempDir, 'config.ts');
    await writeFile(filePath, SAMPLE, 'utf8');
    return filePath;
  }

  test('outline → patch → verify updated outline', async () => {
    await setup();

    // Step 1: Read outline
    const outline = await codeOutline(SAMPLE, { language: 'typescript', filePath });
    const loadNode = outline.nodes.find((n) => n.name === 'loadConfig');
    expect(loadNode).toBeDefined();
    expect(loadNode!.hash).toBeDefined();

    // Step 2: Patch using the hash from outline
    const result = await patch({
      file: filePath,
      symbol: 'loadConfig',
      hash: loadNode!.hash!,
      body: 'export function loadConfig(path: string): Config {\n  const raw = readFile(path, "utf8");\n  return JSON.parse(raw) as Config;\n}',
    });
    expect(result.ok).toBe(true);

    // Step 3: Verify file changed and hash is different
    const updated = await readFile(filePath, 'utf8');
    expect(updated).toContain('as Config');
    const newOutline = await codeOutline(updated, { language: 'typescript', filePath });
    const newNode = newOutline.nodes.find((n) => n.name === 'loadConfig');
    expect(newNode!.hash).not.toBe(loadNode!.hash);
  });

  test('outline → insert → verify new symbol exists', async () => {
    await setup();

    const outline = await codeOutline(SAMPLE, { language: 'typescript', filePath });
    const saveNode = outline.nodes.find((n) => n.name === 'saveConfig');

    const result = await insert({
      file: filePath,
      position: 'after:saveConfig',
      anchor_hash: saveNode!.hash!,
      body: 'export function deleteConfig(path: string): void {\n  unlinkSync(path);\n}',
    });
    expect(result.ok).toBe(true);

    const updated = await readFile(filePath, 'utf8');
    expect(updated).toContain('deleteConfig');
    const newOutline = await codeOutline(updated, { language: 'typescript', filePath });
    expect(newOutline.nodes.some((n) => n.name === 'deleteConfig')).toBe(true);
  });

  test('outline → rename → verify all references updated', async () => {
    await setup();

    const outline = await codeOutline(SAMPLE, { language: 'typescript', filePath });
    const loadNode = outline.nodes.find((n) => n.name === 'loadConfig');

    const result = await rename({
      file: filePath,
      symbol: 'loadConfig',
      hash: loadNode!.hash!,
      to: 'readConfig',
      scope: join(tempDir, '**/*.ts'),
    });
    expect(result.ok).toBe(true);

    const updated = await readFile(filePath, 'utf8');
    expect(updated).toContain('readConfig');
    expect(updated).not.toMatch(/\bloadConfig\b/);
  });

  test('STALE_READ → re-read → successful patch', async () => {
    await setup();

    // Get initial outline
    const outline = await codeOutline(SAMPLE, { language: 'typescript', filePath });
    const loadNode = outline.nodes.find((n) => n.name === 'loadConfig');

    // Modify file behind our back
    const modified = SAMPLE.replace('JSON.parse(raw)', 'JSON.parse(raw.trim())');
    await writeFile(filePath, modified, 'utf8');

    // Attempt patch with stale hash — should fail
    const result1 = await patch({
      file: filePath,
      symbol: 'loadConfig',
      hash: loadNode!.hash!,
      body: 'export function loadConfig(path: string): Config {\n  return {} as Config;\n}',
    });
    expect(result1.ok).toBe(false);
    if (!result1.ok) {
      expect(result1.error.code).toBe('STALE_READ');
      expect(result1.error.freshOutline).toBeDefined();
    }

    // Re-read and retry with fresh hash
    const freshOutline = await codeOutline(modified, { language: 'typescript', filePath });
    const freshNode = freshOutline.nodes.find((n) => n.name === 'loadConfig');
    const result2 = await patch({
      file: filePath,
      symbol: 'loadConfig',
      hash: freshNode!.hash!,
      body: 'export function loadConfig(path: string): Config {\n  return {} as Config;\n}',
    });
    expect(result2.ok).toBe(true);
  });
});
