const QUOTE = '"';

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
