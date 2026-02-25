import { readFile, stat } from 'node:fs/promises';

export async function readFileText(path: string): Promise<string> {
  return readFile(path, 'utf8');
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
