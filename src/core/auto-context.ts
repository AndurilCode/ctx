import { relative, resolve } from 'node:path';
import { assembleContext } from './context.js';
import { relevance } from './relevance.js';
import type { AutoContextOptions, AutoContextResult, SelectedFile } from '../types/auto-context.js';
import type { ContextSource } from '../types/context.js';
import { discoverFilesCached } from '../utils/discovery-cache.js';
import { extractOutgoingEdges } from '../utils/import-resolver.js';

const HIGH_SCORE_THRESHOLD = 3;
const DEFAULT_MAX_FILES = 15;
const DEFAULT_GLOB = '**/*.{ts,tsx,js,jsx}';
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
    .map(([file]) => file);

  for (let level = 0; level < depth && frontier.length > 0; level++) {
    const nextFrontier = new Set<string>();

    await Promise.all(
      frontier.map(async (absFile) => {
        if (visited.has(absFile)) return;
        visited.add(absFile);

        const relFile = relative(root, absFile);
        const edges = await extractOutgoingEdges(relFile, root);
        for (const edge of edges) {
          const absEdge = resolve(root, edge.resolved);
          if (!fileMap.has(absEdge)) {
            fileMap.set(absEdge, { score: 0, priority: 'low' });
          }
          if (!visited.has(absEdge)) {
            nextFrontier.add(absEdge);
          }
        }
      }),
    );

    frontier = [...nextFrontier];
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

  if (depth > 0) {
    await expandOutgoingImports(root, fileMap, depth);
  }

  const sorted = [...fileMap.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, maxFiles);

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
