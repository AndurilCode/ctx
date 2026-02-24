import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import fg from 'fast-glob';

function hasDataOnStdin(): boolean {
  return !process.stdin.isTTY;
}

export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }

  return Buffer.concat(chunks).toString('utf8');
}

export async function readInput(path?: string): Promise<string> {
  if (path) {
    return readFile(resolve(path), 'utf8');
  }

  if (hasDataOnStdin()) {
    return readStdin();
  }

  throw new Error('No input provided. Pass a file path or pipe input through stdin.');
}

export async function writeOutput(content: string, outPath?: string): Promise<void> {
  if (!outPath) {
    process.stdout.write(content);
    if (!content.endsWith('\n')) {
      process.stdout.write('\n');
    }
    return;
  }

  const absolute = resolve(outPath);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, content, 'utf8');
}

export async function resolveInputPaths(pattern: string): Promise<string[]> {
  if (!/[?*\[\]{}()]/.test(pattern)) {
    return [resolve(pattern)];
  }

  const matches = await fg(pattern, { onlyFiles: true, unique: true });
  return matches.map((match) => resolve(match));
}
