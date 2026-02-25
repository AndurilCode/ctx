import { basename } from 'node:path';
import type { RelevanceMatch } from '../types/relevance.js';

export function scoreFile(
  query: string,
  filePath: string,
  content: string,
  symbols: string[],
  headings: string[],
): RelevanceMatch {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches: string[] = [];
  let score = 0;

  // Filename match (weight: 3)
  const name = basename(filePath).toLowerCase();
  for (const term of terms) {
    if (name.includes(term)) {
      score += 3;
      matches.push(`filename: ${basename(filePath)}`);
    }
  }

  // Symbol match (weight: 2)
  for (const sym of symbols) {
    const symLower = sym.toLowerCase();
    for (const term of terms) {
      if (symLower.includes(term)) {
        score += 2;
        matches.push(`symbol: ${sym}`);
      }
    }
  }

  // Heading match (weight: 2)
  for (const heading of headings) {
    const headLower = heading.toLowerCase();
    for (const term of terms) {
      if (headLower.includes(term)) {
        score += 2;
        matches.push(`heading: ${heading}`);
      }
    }
  }

  // Content match (weight: 1 per occurrence, capped at 5)
  const contentLower = content.toLowerCase();
  for (const term of terms) {
    const occurrences = Math.min(countOccurrences(contentLower, term), 5);
    score += occurrences;
  }

  return { file: filePath, score, matches: [...new Set(matches)] };
}

function countOccurrences(text: string, term: string): number {
  let count = 0;
  let pos = 0;
  while ((pos = text.indexOf(term, pos)) !== -1) {
    count++;
    pos += term.length;
  }
  return count;
}

export function extractSymbolNames(content: string): string[] {
  const pattern = /(?:export\s+)?(?:function|const|let|var|class|interface|type|enum)\s+(\w+)/g;
  const names: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(content)) !== null) {
    names.push(m[1] as string);
  }
  return names;
}

export function extractHeadings(content: string): string[] {
  const headings: string[] = [];
  for (const line of content.split('\n')) {
    const m = line.match(/^#{1,6}\s+(.+)/);
    if (m) headings.push(m[1] as string);
  }
  return headings;
}
