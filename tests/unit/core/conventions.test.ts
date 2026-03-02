import { describe, expect, test } from 'bun:test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { conventions } from '../../../src/core/conventions.js';

describe('conventions', () => {
  test('infers high-confidence conventions for src/core', async () => {
    const result = await conventions({ directory: 'src/core', maxFiles: 6 });
    expect(result.directory).toContain('src/core');
    expect(result.output).toContain('── conventions');
    expect(result.sampledFiles).toBeGreaterThan(0);
  });

  test('does not over-claim import type convention when prevalence is low', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ctx-conventions-rare-type-'));
    const fileBodies = [
      `import { a } from './a.js';\nimport { b } from './b.js';\nexport function one(): number { return a + b; }\n`,
      `import { a } from './a.js';\nimport { c } from './c.js';\nexport function two(): number { return a + c; }\n`,
      `import { a } from './a.js';\nimport { d } from './d.js';\nexport function three(): number { return a + d; }\n`,
      `import { a } from './a.js';\nimport type { T } from './types.js';\nexport function four(value: T): number { return a + value.n; }\n`,
    ];
    await Promise.all(
      fileBodies.map((body, index) => writeFile(join(dir, `f${index}.ts`), body, 'utf8')),
    );

    const result = await conventions({ directory: dir, maxFiles: 10, threshold: 0.7 });
    expect(result.output).not.toContain('`import type` separation is common');
    expect(result.output).toContain('.js import extensions are consistently used');
  });

  test('reports relative imports when prevalent across files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ctx-conventions-relative-'));
    const fileBodies = [
      `import { a } from './a.js';\nimport { b } from './b.js';\nexport function one(): number { return a + b; }\n`,
      `import { a } from './a.js';\nimport { c } from './c.js';\nexport function two(): number { return a + c; }\n`,
      `import { a } from './a.js';\nimport { d } from './d.js';\nexport function three(): number { return a + d; }\n`,
      `import fs from 'node:fs';\nexport function four(): number { return fs ? 1 : 0; }\n`,
    ];
    await Promise.all(
      fileBodies.map((body, index) => writeFile(join(dir, `g${index}.ts`), body, 'utf8')),
    );

    const result = await conventions({ directory: dir, maxFiles: 10, threshold: 0.7 });
    expect(result.output).toContain('relative imports are dominant');
  });
});
