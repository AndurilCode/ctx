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

  let inCode = false;
  let index = 0;

  const resetCountersFrom = (depth: number): void => {
    for (let i = depth; i < orderedCounters.length; i += 1) {
      orderedCounters[i] = 0;
    }
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
      const indent = '  '.repeat(listLine.depth);

      if (listLine.marker === '+') {
        const next = (orderedCounters[listLine.depth] ?? 0) + 1;
        orderedCounters[listLine.depth] = next;
        resetCountersFrom(listLine.depth + 1);
        output.push(`${indent}${next}. ${listLine.text}`.trimEnd());
        index += 1;
        continue;
      }

      resetCountersFrom(listLine.depth);

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
      resetCountersFrom(0);
    }

    output.push(line);
    index += 1;
  }

  if (inCode) {
    output.push('```');
  }

  return markdownToAst(output.join('\n'));
}
