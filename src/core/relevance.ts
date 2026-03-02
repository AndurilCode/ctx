import type { RelevanceOptions, RelevanceResult } from '../types/relevance.js';
import { computeIdfMap, scoreContentTermsBM25 } from '../utils/bm25.js';
import { readFileText } from '../utils/file-reader.js';
import {
  commitRelevanceMetadata,
  getRelevanceMetadata,
  setRelevanceMetadata,
} from '../utils/relevance-cache.js';
import { extractHeadings, extractSymbolNames } from '../utils/extractors.js';
import { queryTerms, scoreMetadataTerms } from '../utils/relevance.js';

export async function relevance(options: RelevanceOptions): Promise<RelevanceResult> {
  const { query, files, maxResults = 10 } = options;
  const terms = queryTerms(query);

  // Metadata pass — also keeps content for reuse in the content-scoring phase
  const candidates = await Promise.all(
    files.map(async (file) => {
      try {
        const cached = await getRelevanceMetadata(file);
        if (cached) {
          const base = scoreMetadataTerms(terms, file, cached.symbols, cached.headings);
          return { file, base, content: undefined as string | undefined };
        }
        const content = await readFileText(file);
        const symbols = extractSymbolNames(content);
        const headings = extractHeadings(content);
        await setRelevanceMetadata(file, symbols, headings);
        const base = scoreMetadataTerms(terms, file, symbols, headings);
        return { file, base, content };
      } catch {
        return { file, base: { score: 0, matches: [] as string[] }, content: undefined };
      }
    }),
  );
  await commitRelevanceMetadata();

  // Phase 1: load content for ALL candidates (reuse from metadata pass, read missing)
  const contentMap = new Map<string, string>();
  await Promise.all(
    candidates.map(async (c) => {
      if (c.content) {
        contentMap.set(c.file, c.content);
        return;
      }
      try {
        contentMap.set(c.file, await readFileText(c.file));
      } catch {
        /* unreadable — skip */
      }
    }),
  );

  // Phase 2: compute BM25 corpus statistics over ALL loaded content
  const { idfMap, avgdl } = computeIdfMap(terms, [...contentMap.values()]);

  // Phase 3: BM25-score every candidate
  const scored = candidates.map((c) => {
    const content = contentMap.get(c.file);
    const contentScore = content ? scoreContentTermsBM25(terms, content, idfMap, avgdl) : 0;
    return { file: c.file, score: c.base.score + contentScore, matches: c.base.matches };
  });

  const sorted = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
  return { results: sorted.slice(0, maxResults) };
}
