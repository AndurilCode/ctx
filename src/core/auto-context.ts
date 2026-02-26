import { relative, resolve } from 'node:path';
import type { AutoContextOptions, AutoContextResult, SelectedFile } from '../types/auto-context.js';
import type { ContextSource } from '../types/context.js';
import { discoverFilesCached } from '../utils/discovery-cache.js';
import { extractOutgoingEdges } from '../utils/import-resolver.js';
import { assembleContext } from './context.js';
import { relevance } from './relevance.js';

export const HIGH_SCORE_THRESHOLD = 5;
export const MIN_SHARED_IMPORTERS = 2;
const DEFAULT_MAX_FILES = 15;
const DEFAULT_GLOB = '**/*.{ts,tsx,js,jsx,md,mdx,json,yaml,yml}';
const DEFAULT_DEPTH = 1;
const RELEVANCE_SCAN_LIMIT = 50;
const DEFAULT_IGNORE = ['node_modules/**', 'dist/**', '.git/**'];

interface RankedCandidate {
  score: number;
  priority: 'high' | 'normal' | 'low';
}

async function expandOutgoingImports(
  root: string,
  fileMap: Map<string, RankedCandidate>,
  depth: number,
): Promise<void> {
  const visited = new Set<string>();
  let frontier = [...fileMap.entries()]
    .filter(([, v]) => v.priority === 'high')
    .map(([file, v]) => ({ file, parentScore: v.score }));

  for (let level = 0; level < depth && frontier.length > 0; level++) {
    const nextFrontier = new Map<string, number>(); // file → best parentScore seen

    await Promise.all(
      frontier.map(async ({ file: absFile, parentScore }) => {
        if (visited.has(absFile)) return;
        visited.add(absFile);

        const relFile = relative(root, absFile);
        const edges = await extractOutgoingEdges(relFile, root);
        for (const edge of edges) {
          const absEdge = resolve(root, edge.resolved);
          const derivedScore = Math.max(1, Math.floor(parentScore * 0.5));
          const existing = fileMap.get(absEdge);
          if (!existing) {
            fileMap.set(absEdge, { score: derivedScore, priority: 'low' });
          } else if (existing.priority === 'low' && derivedScore > existing.score) {
            // Update if a higher derived score is found via a different path
            fileMap.set(absEdge, { score: derivedScore, priority: 'low' });
          }
          if (!visited.has(absEdge)) {
            const best = Math.max(nextFrontier.get(absEdge) ?? 0, derivedScore);
            nextFrontier.set(absEdge, best);
          }
        }
      }),
    );

    frontier = [...nextFrontier.entries()].map(([file, parentScore]) => ({ file, parentScore }));
  }
}

async function boostSharedDependencies(
  root: string,
  fileMap: Map<string, RankedCandidate>,
): Promise<void> {
  const scoredFiles = [...fileMap.entries()].filter(([, v]) => v.score > 0);
  const importCounts = new Map<string, number>();

  await Promise.all(
    scoredFiles.map(async ([absFile]) => {
      const edges = await extractOutgoingEdges(relative(root, absFile), root);
      for (const edge of edges) {
        const absEdge = resolve(root, edge.resolved);
        importCounts.set(absEdge, (importCounts.get(absEdge) ?? 0) + 1);
      }
    }),
  );

  for (const [absFile, count] of importCounts) {
    if (count >= MIN_SHARED_IMPORTERS && !fileMap.has(absFile)) {
      fileMap.set(absFile, { score: count, priority: 'low' });
    }
  }
}

export async function autoContext(options: AutoContextOptions): Promise<AutoContextResult> {
  const root = resolve(options.path ?? '.');
  const globPattern = options.glob ?? DEFAULT_GLOB;
  const depth = options.depth ?? DEFAULT_DEPTH;
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;

  const relFiles = await discoverFilesCached({
    root,
    globPattern,
    ignore: DEFAULT_IGNORE,
  });
  const absFiles = relFiles.map((file) => resolve(root, file));

  const { results: scored } = await relevance({
    query: options.query,
    files: absFiles,
    maxResults: RELEVANCE_SCAN_LIMIT,
  });

  const fileMap = new Map<string, RankedCandidate>();

  for (const seed of options.seeds ?? []) {
    fileMap.set(resolve(root, seed), { score: 100, priority: 'high' });
  }

  for (const match of scored) {
    if (!fileMap.has(match.file)) {
      fileMap.set(match.file, {
        score: match.score,
        priority: match.score >= HIGH_SCORE_THRESHOLD ? 'high' : 'normal',
      });
    }
  }

  await boostSharedDependencies(root, fileMap);

  if (depth > 0) {
    await expandOutgoingImports(root, fileMap, depth);
  }

  const sorted = [...fileMap.entries()].sort((a, b) => b[1].score - a[1].score).slice(0, maxFiles);

  const cwd = resolve('.');
  const selectedFiles: SelectedFile[] = sorted.map(([absFile, { score, priority }]) => ({
    file: relative(cwd, absFile),
    score,
    priority,
  }));

  const sources: ContextSource[] = selectedFiles.map(({ file, priority }) => ({ file, priority }));
  const context = await assembleContext({ sources, maxTokens: options.maxTokens });

  return {
    ...context,
    query: options.query,
    selectedFiles,
  };
}
