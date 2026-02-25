import type { RelevanceOptions, RelevanceResult } from '../types/relevance.js';
import { readFileText } from '../utils/file-reader.js';
import { extractHeadings, extractSymbolNames, scoreFile } from '../utils/relevance.js';

export async function relevance(options: RelevanceOptions): Promise<RelevanceResult> {
  const { query, files, maxResults = 10 } = options;

  const scored = await Promise.all(
    files.map(async (file) => {
      try {
        const content = await readFileText(file);
        const symbols = extractSymbolNames(content);
        const headings = extractHeadings(content);
        return scoreFile(query, file, content, symbols, headings);
      } catch {
        return { file, score: 0, matches: [] };
      }
    }),
  );

  const sorted = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
  return { results: sorted.slice(0, maxResults) };
}
