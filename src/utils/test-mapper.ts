import { resolve } from 'node:path';
import type { SymbolUsage } from '../types/symbols.js';
import { readFileText } from './file-reader.js';
import { findUsagesInContent } from './symbol-index.js';
import { fileImports } from '../core/imports.js';

export interface TestTarget {
  file: string;
  usages: SymbolUsage[];
}

function isTestFile(pathValue: string): boolean {
  return /(^|\/)(__tests__|tests?|specs?)(\/|$)|\.(test|spec)\./i.test(pathValue);
}

export async function mapTestsForFiles(
  files: string[],
  root = '.',
  symbol?: string,
): Promise<TestTarget[]> {
  const targets = new Map<string, SymbolUsage[]>();

  for (const file of files) {
    if (isTestFile(file) && !targets.has(file)) targets.set(file, []);
    try {
      const incoming = await fileImports({
        file: resolve(root, file),
        direction: 'incoming',
        root,
      });
      for (const candidate of incoming.incoming) {
        if (!isTestFile(candidate)) continue;
        if (!targets.has(candidate)) targets.set(candidate, []);
      }
    } catch {
      // Ignore import graph failures.
    }
  }

  if (!symbol) {
    return [...targets.keys()].map((file) => ({ file, usages: [] }));
  }

  const out: TestTarget[] = [];
  for (const file of targets.keys()) {
    try {
      const content = await readFileText(resolve(root, file));
      out.push({ file, usages: findUsagesInContent(symbol, file, content).slice(0, 8) });
    } catch {
      // Ignore unreadable tests.
    }
  }
  return out;
}
