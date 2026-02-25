import { replaceAll } from '../utils/text.js';

interface ParsedDedupDictionary {
  entries: Array<readonly [string, string]>;
  nextIndex: number;
}

export function parseDedupDictionary(
  lines: readonly string[],
  startIndex: number,
): ParsedDedupDictionary | null {
  const first = lines[startIndex] ?? '';
  if (!/^§\d+=/.test(first)) {
    return null;
  }

  const entries: Array<readonly [string, string]> = [];
  let cursor = startIndex;
  while (cursor < lines.length) {
    const line = lines[cursor] ?? '';
    if (line === '§§') {
      // Sort by token length descending so §10 is replaced before §1
      const sorted = [...entries].sort((a, b) => (b[0]?.length ?? 0) - (a[0]?.length ?? 0));
      return { entries: sorted, nextIndex: cursor + 1 };
    }

    const match = line.match(/^(§\d+)=(.*)$/);
    if (!match) {
      return null;
    }

    entries.push([match[1] ?? '', match[2] ?? '']);
    cursor += 1;
  }

  return null;
}

export function expandDedupTokens(
  line: string,
  entries: ReadonlyArray<readonly [string, string]>,
): string {
  let expanded = line;
  for (const [token, value] of entries) {
    expanded = replaceAll(expanded, token, value);
  }
  return expanded;
}
