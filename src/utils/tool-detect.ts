import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export interface DetectedTools {
  testCommand?: string;
  typeCommand?: string;
}

export async function detectTools(root = '.'): Promise<DetectedTools> {
  const absRoot = resolve(root);
  const packageJsonPath = resolve(absRoot, 'package.json');
  const tsconfigPath = resolve(absRoot, 'tsconfig.json');

  let testCommand: string | undefined;
  let typeCommand: string | undefined;

  if (existsSync(packageJsonPath)) {
    try {
      const raw = await readFile(packageJsonPath, 'utf8');
      const parsed = JSON.parse(raw) as { scripts?: Record<string, string> };
      if (parsed.scripts?.test) {
        testCommand = 'npm test --';
      } else if (existsSync(resolve(absRoot, 'bun.lock'))) {
        testCommand = 'bun test';
      } else {
        testCommand = 'npm test --';
      }
    } catch {
      // Fall back below.
    }
  }

  if (!testCommand) {
    if (existsSync(resolve(absRoot, 'bun.lock'))) testCommand = 'bun test';
    else if (existsSync(resolve(absRoot, 'pytest.ini')) || existsSync(resolve(absRoot, 'pyproject.toml')))
      testCommand = 'pytest';
    else if (existsSync(resolve(absRoot, 'Cargo.toml'))) testCommand = 'cargo test';
    else if (existsSync(resolve(absRoot, 'go.mod'))) testCommand = 'go test ./...';
  }

  if (existsSync(tsconfigPath)) typeCommand = 'bun run tsc --noEmit';
  else if (existsSync(resolve(absRoot, 'pyproject.toml'))) typeCommand = 'mypy .';

  return { testCommand, typeCommand };
}
