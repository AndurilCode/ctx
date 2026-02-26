/**
 * BM25 probabilistic relevance scorer.
 * k1=1.5 (TF saturation), b=0.75 (length normalisation).
 */

import { countOccurrences } from './relevance.js';

/**
 * BM25 term-frequency/IDF content scorer.
 * Returns 0 when content is empty or avgdl is zero.
 */
export function scoreContentTermsBM25(
  terms: string[],
  content: string,
  idfMap: Map<string, number>,
  avgdl: number,
): number {
  if (!content || avgdl === 0) return 0;
  const k1 = 1.5;
  const b = 0.75;
  const docLen = content.length;
  const contentLower = content.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (!term) continue;
    const tf = countOccurrences(contentLower, term);
    if (tf === 0) continue;
    const idf = idfMap.get(term) ?? Math.log(1.5); // fallback: modest IDF
    const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLen / avgdl)));
    score += idf * tfNorm;
  }
  return score;
}

/**
 * Compute IDF map and average document length over a corpus of content strings.
 * Used by core/relevance.ts before BM25 content scoring.
 */
export function computeIdfMap(
  terms: string[],
  contents: string[],
): { idfMap: Map<string, number>; avgdl: number } {
  const N = contents.length;
  if (N === 0) return { idfMap: new Map(), avgdl: 1 };

  const df = new Map<string, number>();
  let totalLen = 0;
  for (const content of contents) {
    totalLen += content.length;
    const lower = content.toLowerCase();
    for (const term of terms) {
      if (term && lower.includes(term)) {
        df.set(term, (df.get(term) ?? 0) + 1);
      }
    }
  }

  const idfMap = new Map<string, number>();
  for (const term of terms) {
    const docFreq = df.get(term) ?? 0;
    idfMap.set(term, Math.log((N - docFreq + 0.5) / (docFreq + 0.5) + 1));
  }

  return { idfMap, avgdl: totalLen / N };
}
