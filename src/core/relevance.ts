import type { RelevanceOptions, RelevanceResult } from '../types/relevance.js';
import { computeIdfMap, scoreContentTermsBM25 } from '../utils/bm25.js';
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
  scoreMetadataTerms,
} from '../utils/relevance.js';

const DARK_MATTER_SAMPLE = 10;

export async function relevance(options: RelevanceOptions): Promise<RelevanceResult> {
  const { query, files, maxResults = 10 } = options;
  const contentScanMultiplier = Math.max(1, Math.floor(options.contentScanMultiplier ?? 4));
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
        return { file, symbols, headings, base, content: base.score > 0 ? content : undefined };
      } catch {
        return { file, symbols: [], headings: [], base: { score: 0, matches: [] } };
      }
    }),
  );
  await commitRelevanceMetadata();

  const candidates = [...metadataScored].sort((a, b) => b.base.score - a.base.score);

  const withScore = candidates.filter((c) => c.base.score > 0);
  const zeroScore = candidates.filter((c) => c.base.score === 0);

  // Randomly sample zero-scored files to catch content-only relevant matches ("dark matter")
  const darkMatter = [...zeroScore].sort(() => Math.random() - 0.5).slice(0, DARK_MATTER_SAMPLE);

  const contentScanLimit = Math.min(withScore.length, maxResults * contentScanMultiplier);
  const contentScoredFiles = new Set([
    ...withScore.slice(0, contentScanLimit).map((c) => c.file),
    ...darkMatter.map((c) => c.file),
  ]);

  // Phase 1: load content for all candidates in the scan set
  const contentMap = new Map<string, string>();
  await Promise.all(
    [...contentScoredFiles].map(async (file) => {
      // Reuse content already loaded during the metadata pass when available
      const candidate = metadataScored.find((c) => c.file === file);
      if (candidate?.content) {
        contentMap.set(file, candidate.content);
        return;
      }
      try {
        contentMap.set(file, await readFileText(file));
      } catch {
        // file unreadable — skip
      }
    }),
  );

  // Phase 2: compute BM25 corpus statistics over the loaded content
  // Dark-matter files are included in corpus stats: if they contain query terms,
  // they participate in IDF, which may slightly suppress scores for non-dark-matter files.
  const { idfMap, avgdl } = computeIdfMap(terms, [...contentMap.values()]);

  // Phase 3: score every candidate (BM25 for content-scan set, metadata-only for the rest)
  const scored = candidates.map((candidate) => {
    if (!contentScoredFiles.has(candidate.file)) {
      return { file: candidate.file, score: candidate.base.score, matches: candidate.base.matches };
    }
    const content = contentMap.get(candidate.file);
    if (!content) {
      return { file: candidate.file, score: candidate.base.score, matches: candidate.base.matches };
    }
    const contentScore = scoreContentTermsBM25(terms, content, idfMap, avgdl);
    return {
      file: candidate.file,
      score: candidate.base.score + contentScore,
      matches: candidate.base.matches,
    };
  });

  const sorted = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
  return { results: sorted.slice(0, maxResults) };
}
