import type { RelevanceOptions, RelevanceResult } from '../types/relevance.js';
import { readFileText } from '../utils/file-reader.js';
import {
  commitRelevanceMetadata,
  getRelevanceMetadata,
  setRelevanceMetadata,
} from '../utils/relevance-cache.js';
import {
  extractHeadings,
  extractSymbolNames,
  queryTerms,
  scoreContentTerms,
  scoreMetadataTerms,
} from '../utils/relevance.js';

export async function relevance(options: RelevanceOptions): Promise<RelevanceResult> {
  const { query, files, maxResults = 10 } = options;
  const terms = queryTerms(query);

  const metadataScored = await Promise.all(
    files.map(async (file) => {
      try {
        const cached = await getRelevanceMetadata(file);
        if (cached) {
          const base = scoreMetadataTerms(terms, file, cached.symbols, cached.headings);
          return { file, symbols: cached.symbols, headings: cached.headings, base };
        }

        const content = await readFileText(file);
        const symbols = extractSymbolNames(content);
        const headings = extractHeadings(content);
        await setRelevanceMetadata(file, symbols, headings);
        const base = scoreMetadataTerms(terms, file, symbols, headings);
        return { file, symbols, headings, base };
      } catch {
        return { file, symbols: [], headings: [], base: { score: 0, matches: [] } };
      }
    }),
  );
  await commitRelevanceMetadata();

  const candidates = [...metadataScored].sort((a, b) => b.base.score - a.base.score);

  const scored = await Promise.all(
    candidates.map(async (candidate) => {
      try {
        const content = await readFileText(candidate.file);
        const contentScore = scoreContentTerms(terms, content);
        return {
          file: candidate.file,
          score: candidate.base.score + contentScore,
          matches: candidate.base.matches,
        };
      } catch {
        return { file: candidate.file, score: candidate.base.score, matches: candidate.base.matches };
      }
    }),
  );

  const sorted = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
  return { results: sorted.slice(0, maxResults) };
}
