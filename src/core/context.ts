import type { ContextOptions, ContextResult, ContextSourceResult } from '../types/context.js';
import { budgetedRead } from './read.js';
import { readFileText } from '../utils/file-reader.js';
import { createTokenCounter } from '../utils/tokens.js';

const PRIORITY_WEIGHTS: Record<string, number> = { high: 2, normal: 1, low: 0.25 };
const PRIORITY_ORDER: Record<string, number> = { high: 3, normal: 2, low: 1 };

export async function assembleContext(options: ContextOptions): Promise<ContextResult> {
  const { sources, maxTokens, strategy } = options;
  const counter = await createTokenCounter();

  // Phase 1: measure each source
  const measurements = await Promise.all(
    sources.map(async (source) => {
      const content = await readFileText(source.file);
      return { source, content, totalTokens: counter.count(content) };
    }),
  );

  const grandTotal = measurements.reduce((sum, m) => sum + m.totalTokens, 0);

  // Phase 2: if everything fits, return full content
  if (grandTotal <= maxTokens) {
    const parts: string[] = [];
    const sourceResults: ContextSourceResult[] = [];
    for (const m of measurements) {
      parts.push(`## ${m.source.file} (full, ${m.totalTokens}t)\n\n${m.content}`);
      sourceResults.push({ file: m.source.file, strategy: 'full', tokens: m.totalTokens });
    }
    const content = parts.join('\n\n---\n\n');
    return { content, totalTokens: grandTotal, budget: maxTokens, sources: sourceResults };
  }

  // Phase 3: allocate proportionally with priority weights
  const totalWeight = measurements.reduce((sum, m) => {
    const w = PRIORITY_WEIGHTS[m.source.priority ?? 'normal'] ?? 1;
    return sum + m.totalTokens * w;
  }, 0);

  // Compute initial allocations (not capped — let budgetedRead enforce limits)
  const allocations = measurements.map((m) => {
    const w = PRIORITY_WEIGHTS[m.source.priority ?? 'normal'] ?? 1;
    const allocated = Math.max(10, Math.floor(((m.totalTokens * w) / totalWeight) * maxTokens));
    return { m, allocated };
  });

  // Redistribute surplus from fully-satisfied sources only to same-or-higher priority uncapped sources
  let changed = true;
  while (changed) {
    changed = false;
    for (const a of allocations) {
      if (a.allocated <= a.m.totalTokens) continue;
      // This source is over-allocated; it will be capped at totalTokens
      const surplus = a.allocated - a.m.totalTokens;
      a.allocated = a.m.totalTokens;
      const srcPriority = PRIORITY_ORDER[a.m.source.priority ?? 'normal'] ?? 2;
      const eligible = allocations.filter(
        (b) =>
          b !== a &&
          b.allocated < b.m.totalTokens &&
          (PRIORITY_ORDER[b.m.source.priority ?? 'normal'] ?? 2) >= srcPriority,
      );
      if (eligible.length === 0) continue;
      const eligWeight = eligible.reduce((s, b) => {
        return s + (PRIORITY_WEIGHTS[b.m.source.priority ?? 'normal'] ?? 1);
      }, 0);
      for (const b of eligible) {
        const w = PRIORITY_WEIGHTS[b.m.source.priority ?? 'normal'] ?? 1;
        b.allocated += Math.floor((w / eligWeight) * surplus);
      }
      changed = true;
    }
  }

  const readResults = await Promise.all(
    allocations.map(({ m, allocated }) =>
      budgetedRead({
        file: m.source.file,
        maxTokens: allocated,
        strategy,
        content: m.content,
        totalTokens: m.totalTokens,
      }),
    ),
  );

  const parts: string[] = [];
  const sourceResults: ContextSourceResult[] = [];
  let usedTokens = 0;

  for (let i = 0; i < allocations.length; i++) {
    const { m } = allocations[i]!;
    const result = readResults[i]!;
    parts.push(
      `## ${m.source.file} (${result.strategy}, ${result.returnedTokens}t of ${m.totalTokens}t)\n\n${result.content}`,
    );
    sourceResults.push({
      file: m.source.file,
      strategy: result.strategy,
      tokens: result.returnedTokens,
    });
    usedTokens += result.returnedTokens;
  }

  const content = parts.join('\n\n---\n\n');
  return { content, totalTokens: usedTokens, budget: maxTokens, sources: sourceResults };
}
