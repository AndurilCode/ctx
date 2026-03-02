import { rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export async function atomicWrite(filePath: string, content: string): Promise<void> {
  const dir = dirname(filePath);
  const tempPath = join(dir, `.ctx-tmp-${process.pid}-${Date.now()}`);
  await writeFile(tempPath, content, 'utf8');
  try {
    await rename(tempPath, filePath);
  } catch (err) {
    await unlink(tempPath).catch(() => {});
    throw err;
  }
}
