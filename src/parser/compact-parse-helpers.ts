import { parseCsvRow } from '../utils/text.js';

export interface ListMatch {
  depth: number;
  marker: '-' | '+' | '[]' | '[x]';
  text: string;
}

export function parseListLine(line: string): ListMatch | null {
  const match = line.match(/^(?<dots>(?:\.\.)*)(?<marker>\-|\+|\[\]|\[[xX]\])(?:\s+(?<text>.*))?$/);
  if (!match?.groups) {
    return null;
  }

  const dots = match.groups.dots ?? '';
  const rawMarker = match.groups.marker ?? '-';
  const marker = (rawMarker.toLowerCase() === '[x]' ? '[x]' : rawMarker) as ListMatch['marker'];
  const text = (match.groups.text ?? '').trim();

  return {
    depth: dots.length / 2,
    marker,
    text,
  };
}

export function toMarkdownTable(lines: readonly string[], delimiter: string): string[] {
  const headerLine = lines[0];
  if (!headerLine) {
    return [];
  }

  const header = parseCsvRow(headerLine.slice(2).trim(), delimiter);
  const markdown = [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`];

  for (const line of lines.slice(1)) {
    const row = parseCsvRow(line.slice(1).trim(), delimiter);
    markdown.push(`| ${row.join(' | ')} |`);
  }

  return markdown;
}
