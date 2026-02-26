import { basename } from 'node:path';
import type { RelevanceMatch } from '../types/relevance.js';

export interface RelevanceScore {
  score: number;
  matches: string[];
}

export function queryTerms(query: string): string[] {
  const whitespaceTokens = query.split(/\s+/).filter(Boolean);
  const expanded: string[] = [];
  for (const token of whitespaceTokens) {
    // Split camelCase BEFORE lowercasing: autoContext → auto, Context → [auto, context]
    const camelParts = token.split(/(?<=[a-z])(?=[A-Z])/);
    // Split snake_case and lowercase each part
    const parts = camelParts
      .flatMap((p) => p.split('_'))
      .map((p) => p.toLowerCase())
      .filter(Boolean);
    expanded.push(...parts);
  }
  return [...new Set(expanded)];
}

export function scoreFile(
  query: string,
  filePath: string,
  content: string,
  symbols: string[],
  headings: string[],
): RelevanceMatch {
  const terms = queryTerms(query);
  return scoreFileWithTerms(terms, filePath, content, symbols, headings);
}

export function scoreFileWithTerms(
  terms: string[],
  filePath: string,
  content: string,
  symbols: string[],
  headings: string[],
): RelevanceMatch {
  const base = scoreMetadataTerms(terms, filePath, symbols, headings);
  const score = base.score + scoreContentTerms(terms, content);
  return { file: filePath, score, matches: base.matches };
}

function termRegex(term: string): RegExp | null {
  if (/^\w+$/.test(term)) {
    return new RegExp(`\\b${term}\\b`, 'i');
  }
  return null; // non-alphanumeric: fall back to includes
}

/** Normalizes camelCase boundaries by inserting spaces, then lowercases.
 *  "getUser" → "get user", "myURLValue" → "my url value"
 *  Hyphens and underscores already act as \W chars for \b, so we only need
 *  to insert spaces at lower→upper transitions. */
function splitCamel(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
}

export function scoreMetadataTerms(
  terms: string[],
  filePath: string,
  symbols: string[],
  headings: string[],
): RelevanceScore {
  const safeTerms = terms.filter(Boolean);
  const matches: string[] = [];
  let score = 0;

  // Compile regexes once per call to avoid redundant construction in loops.
  const reCache = new Map<string, RegExp | null>(safeTerms.map((t) => [t, termRegex(t)]));
  const matches_ = (value: string, term: string): boolean => {
    const re = reCache.get(term)!;
    if (!re) return value.includes(term);
    return re.test(value.replace(/_/g, ' '));
  };

  // Filename match (weight: 3, capped at +3 total)
  const name = basename(filePath).toLowerCase();
  let filenameScore = 0;
  for (const term of safeTerms) {
    if (filenameScore >= 3) break;
    if (matches_(name, term)) {
      filenameScore = 3; // first match fills the cap; break on next iteration
      matches.push(`filename: ${basename(filePath)}`);
    }
  }
  score += filenameScore;

  // Path segment scoring (weight: 1, capped at +2 total)
  // Split on both forward and back slashes; exclude basename (already scored above).
  const segments = filePath.split(/[/\\]/).slice(0, -1);
  let pathScore = 0;
  for (const segment of segments) {
    if (pathScore >= 2) break;
    const segNorm = segment.toLowerCase();
    for (const term of safeTerms) {
      if (matches_(segNorm, term)) {
        pathScore = Math.min(pathScore + 1, 2);
        matches.push(`path: ${segment}`);
        break; // one term match per segment
      }
    }
  }
  score += pathScore;

  // Symbol match (weight: 2, capped at +6 total)
  // Use splitCamel so that \b fires at camelCase boundaries:
  // "getUser" → "get user", enabling \bget\b to match.
  let symbolScore = 0;
  for (const sym of symbols) {
    if (symbolScore >= 6) break;
    const symNorm = splitCamel(sym);
    for (const term of safeTerms) {
      if (matches_(symNorm, term)) {
        symbolScore = Math.min(symbolScore + 2, 6);
        matches.push(`symbol: ${sym}`);
        break; // one term match per symbol
      }
    }
  }
  score += symbolScore;

  // Heading match (weight: 2, capped at +4 total)
  // Use splitCamel so camelCase headings also benefit from word-boundary matching.
  let headingScore = 0;
  for (const heading of headings) {
    if (headingScore >= 4) break;
    const headNorm = splitCamel(heading);
    for (const term of safeTerms) {
      if (matches_(headNorm, term)) {
        headingScore = Math.min(headingScore + 2, 4);
        matches.push(`heading: ${heading}`);
        break;
      }
    }
  }
  score += headingScore;

  return { score, matches: [...new Set(matches)] };
}

// Content scoring uses substring matching intentionally — broad coverage for prose.
// Metadata scoring (scoreMetadataTerms) uses word-boundary matching for precision.
export function scoreContentTerms(terms: string[], content: string): number {
  let score = 0;
  const contentLower = content.toLowerCase();
  for (const term of terms) {
    if (!term) continue; // guard: empty term would infinite-loop countOccurrences
    const occurrences = Math.min(countOccurrences(contentLower, term), 5);
    score += occurrences;
  }
  return score;
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
