interface ParsedDedupDictionary {
  entries: Array<readonly [string, string]>;
  nextIndex: number;
}

function replaceAll(input: string, from: string, to: string): string {
  return input.split(from).join(to);
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
      return { entries, nextIndex: cursor + 1 };
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
  const ordered = [...entries].sort((a, b) => (b[0]?.length ?? 0) - (a[0]?.length ?? 0));
  let expanded = line;
  for (const [token, value] of ordered) {
    expanded = replaceAll(expanded, token, value);
  }
  return expanded;
}
