const QUOTE = '"';
const SMART_PUNCTUATION_MAP: Record<string, string> = {
  '\u2018': "'",
  '\u2019': "'",
  '\u201c': '"',
  '\u201d': '"',
  '\u2013': '-',
  '\u2014': '--',
  '\u2026': '...',
  '\u00a0': ' ',
};

export function stripTrailingWhitespace(input: string): string {
  return input.replace(/[ \t]+$/gm, '');
}

export function collapseBlankLines(input: string): string {
  return input.replace(/\n{3,}/g, '\n\n');
}

export function needsCsvQuoting(value: string, delimiter: string): boolean {
  return value.includes(delimiter) || value.includes('\n') || value.includes(QUOTE);
}

export function quoteCsvValue(value: string, delimiter: string): string {
  if (!needsCsvQuoting(value, delimiter)) {
    return value;
  }

  return `${QUOTE}${value.replaceAll(QUOTE, `${QUOTE}${QUOTE}`)}${QUOTE}`;
}

export function parseCsvRow(input: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index] ?? '';
    const next = input[index + 1] ?? '';

    if (char === QUOTE && inQuotes && next === QUOTE) {
      current += QUOTE;
      index += 1;
      continue;
    }

    if (char === QUOTE) {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

export function csvRow(values: readonly string[], delimiter: string): string {
  return values.map((value) => quoteCsvValue(value, delimiter)).join(`${delimiter} `);
}

export function normalizeSmartPunctuation(input: string): string {
  return input.replace(/[\u2018\u2019\u201c\u201d\u2013\u2014\u2026\u00a0]/g, (char) => {
    return SMART_PUNCTUATION_MAP[char] ?? char;
  });
}

export function stripTrailingHeadingHashes(input: string): string {
  return input.replace(/\s+#+\s*$/, '').trimEnd();
}

export function normalizeSectionQuery(input: string): string {
  return input.trim().toLowerCase();
}

export function containsSectionQuery(heading: string, queries: readonly string[]): boolean {
  const normalizedHeading = normalizeSectionQuery(heading);
  return queries.some((query) => normalizedHeading.includes(query));
}

export function unwrapSoftLineBreaks(input: string): string {
  return input.replace(/(?<!\n)\n(?!\n)/g, ' ');
}
