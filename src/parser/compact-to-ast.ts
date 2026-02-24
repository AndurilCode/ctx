import type { Root } from 'mdast';
import type { ExpandOptions } from '../types/options.js';
import { parseCsvRow } from '../utils/text.js';
import { VERSION_MARKER } from './constants.js';
import { expandDedupTokens, parseDedupDictionary } from './dedup-dictionary.js';
import { markdownToAst } from './markdown-to-ast.js';

interface ListMatch {
  depth: number;
  marker: '-' | '+' | '[]' | '[x]';
  text: string;
}

function parseListLine(line: string): ListMatch | null {
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

function toMarkdownTable(lines: readonly string[], delimiter: string): string[] {
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

export function compactToAst(input: string, options: ExpandOptions = {}): Root {
  const delimiter = options.tableDelimiter ?? ',';
  const lines = input.replace(/\r\n/g, '\n').split('\n');
  const output: string[] = [];
  const orderedCounters: number[] = [];
  const depthIsOrdered: boolean[] = [];
  const dedupEntries: Array<readonly [string, string]> = [];

  let inCode = false;
  let index = 0;
  let lastNonBlankWasList = false;

  const resetCountersFrom = (depth: number): void => {
    for (let i = depth; i < orderedCounters.length; i += 1) {
      orderedCounters[i] = 0;
    }
  };

  const indentFor = (depth: number): string => {
    let spaces = 0;
    for (let d = 0; d < depth; d += 1) {
      if (depthIsOrdered[d]) {
        spaces += String(orderedCounters[d] ?? 1).length + 2;
      } else {
        spaces += 2;
      }
    }
    return ' '.repeat(spaces);
  };

  while (index < lines.length) {
    const line = lines[index] ?? '';
    const decodedLine = dedupEntries.length > 0 ? expandDedupTokens(line, dedupEntries) : line;

    if (line === VERSION_MARKER) {
      index += 1;
      if ((lines[index] ?? '') === '') {
        index += 1;
      }
      continue;
    }

    if (!inCode && dedupEntries.length === 0) {
      const parsed = parseDedupDictionary(lines, index);
      if (parsed) {
        dedupEntries.push(...parsed.entries);
        index = parsed.nextIndex;
        continue;
      }
    }

    if (inCode) {
      if (line.trim() === '`' || line.trim() === '``') {
        output.push('```');
        inCode = false;
      } else {
        output.push(decodedLine);
      }

      index += 1;
      continue;
    }

    if (
      decodedLine.startsWith('`') &&
      !decodedLine.startsWith('```') &&
      decodedLine.trim() !== '``'
    ) {
      const lang = decodedLine.slice(1).trim();
      output.push(`\`\`\`${lang}`);
      inCode = true;
      index += 1;
      continue;
    }

    if (decodedLine.startsWith('\\:')) {
      output.push(decodedLine.slice(1));
      index += 1;
      continue;
    }

    const heading = decodedLine.match(/^:([1-6])\s+(.*)$/);
    if (heading) {
      output.push(`${'#'.repeat(Number(heading[1]))} ${heading[2] ?? ''}`.trimEnd());
      resetCountersFrom(0);
      index += 1;
      continue;
    }

    if (decodedLine.trim() === '~') {
      output.push('---');
      resetCountersFrom(0);
      index += 1;
      continue;
    }

    if (decodedLine.startsWith('|:')) {
      const tableLines: string[] = [decodedLine];
      let cursor = index + 1;
      while (expandDedupTokens(lines[cursor] ?? '', dedupEntries).startsWith('| ')) {
        tableLines.push(expandDedupTokens(lines[cursor] ?? '', dedupEntries));
        cursor += 1;
      }

      output.push(...toMarkdownTable(tableLines, delimiter));
      resetCountersFrom(0);
      index = cursor;
      continue;
    }

    const listLine = parseListLine(decodedLine);
    if (listLine) {
      lastNonBlankWasList = true;

      if (listLine.marker === '+') {
        const next = (orderedCounters[listLine.depth] ?? 0) + 1;
        orderedCounters[listLine.depth] = next;
        depthIsOrdered[listLine.depth] = true;
        resetCountersFrom(listLine.depth + 1);
        const indent = indentFor(listLine.depth);
        output.push(`${indent}${next}. ${listLine.text}`.trimEnd());
        index += 1;
        continue;
      }

      depthIsOrdered[listLine.depth] = false;
      resetCountersFrom(listLine.depth);
      const indent = indentFor(listLine.depth);

      if (listLine.marker === '[]' || listLine.marker === '[x]') {
        const check = listLine.marker === '[x]' ? 'x' : ' ';
        output.push(`${indent}- [${check}] ${listLine.text}`.trimEnd());
        index += 1;
        continue;
      }

      output.push(`${indent}- ${listLine.text}`.trimEnd());
      index += 1;
      continue;
    }

    if (decodedLine.trim() === '') {
      let lookahead = index + 1;
      while (
        lookahead < lines.length &&
        expandDedupTokens(lines[lookahead] ?? '', dedupEntries).trim() === ''
      ) {
        lookahead += 1;
      }
      const nextIsListItem =
        parseListLine(expandDedupTokens(lines[lookahead] ?? '', dedupEntries)) !== null;
      if (!(lastNonBlankWasList && nextIsListItem)) {
        resetCountersFrom(0);
      }
    } else {
      lastNonBlankWasList = false;
    }

    output.push(decodedLine);
    index += 1;
  }

  if (inCode) {
    output.push('```');
  }

  return markdownToAst(output.join('\n'));
}
