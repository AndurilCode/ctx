import type { Root } from 'mdast';
import type { ExpandOptions } from '../types/options.js';
import { parseCsvRow } from '../utils/text.js';
import { VERSION_MARKER } from './constants.js';
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
  // Track whether the list at each depth is ordered, to compute correct indent
  const depthIsOrdered: boolean[] = [];

  let inCode = false;
  let index = 0;
  // Track whether the last non-blank content line was a list item, so blank
  // lines between list items (loose lists) don't reset the ordered counter.
  let lastNonBlankWasList = false;

  const resetCountersFrom = (depth: number): void => {
    for (let i = depth; i < orderedCounters.length; i += 1) {
      orderedCounters[i] = 0;
    }
  };

  // Compute the indentation string for a given depth.
  // Each level contributes its marker width: `N. ` for ordered, `- ` for unordered.
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

    if (line === VERSION_MARKER) {
      index += 1;
      if ((lines[index] ?? '') === '') {
        index += 1;
      }
      continue;
    }

    if (inCode) {
      if (line.trim() === '``') {
        output.push('```');
        inCode = false;
      } else {
        output.push(line);
      }

      index += 1;
      continue;
    }

    if (line.startsWith('`') && !line.startsWith('```') && line.trim() !== '``') {
      const lang = line.slice(1).trim();
      output.push(`\`\`\`${lang}`);
      inCode = true;
      index += 1;
      continue;
    }

    if (line.startsWith('\\:')) {
      output.push(line.slice(1));
      index += 1;
      continue;
    }

    const heading = line.match(/^:([1-6])\s+(.*)$/);
    if (heading) {
      output.push(`${'#'.repeat(Number(heading[1]))} ${heading[2] ?? ''}`.trimEnd());
      resetCountersFrom(0);
      index += 1;
      continue;
    }

    if (line.trim() === '~') {
      output.push('---');
      resetCountersFrom(0);
      index += 1;
      continue;
    }

    if (line.startsWith('|:')) {
      const tableLines: string[] = [line];
      let cursor = index + 1;
      while ((lines[cursor] ?? '').startsWith('| ')) {
        tableLines.push(lines[cursor] ?? '');
        cursor += 1;
      }

      output.push(...toMarkdownTable(tableLines, delimiter));
      resetCountersFrom(0);
      index = cursor;
      continue;
    }

    const listLine = parseListLine(line);
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

    if (line.trim() === '') {
      // If this blank line falls between two list items (loose list separator),
      // preserve it without resetting counters so ordered numbering continues.
      let lookahead = index + 1;
      while (lookahead < lines.length && (lines[lookahead] ?? '').trim() === '') {
        lookahead += 1;
      }
      const nextIsListItem = parseListLine(lines[lookahead] ?? '') !== null;
      if (!(lastNonBlankWasList && nextIsListItem)) {
        resetCountersFrom(0);
      }
    } else {
      lastNonBlankWasList = false;
    }

    output.push(line);
    index += 1;
  }

  if (inCode) {
    output.push('```');
  }

  return markdownToAst(output.join('\n'));
}
