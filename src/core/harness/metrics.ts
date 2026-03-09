import type { HarnessState } from '../../types/harness.js';
import { MUTATION_TOOLS, READ_TOOLS } from './constants.js';

export interface SessionMetrics {
  totalTokensConsumed: number;
  tokensPerMutation: number;      // Infinity if 0 mutations
  readsPerMutation: number;       // Infinity if 0 mutations
  reclassifications: number;      // always 0 for now (tracked externally)
  depthEscalations: number;       // from state.signals
  cacheHitRate: number;           // reads with 0 tokens / total reads
  starterPacketCoverage: number;  // always 0 for now
  wastedReads: number;            // files read but never mutated
  rewriteAcceptanceRate: number;  // followed / (followed + ignored), 1 if none
  mutationSafetyBlocks: number;
  staleEvidenceCatches: number;
  downgrades: { rewriteToContext: number; returnCachedToDeny: number; injectBeforeToWarn: number; total: number };
}

export function computeMetrics(state: HarnessState): SessionMetrics {
  const { history, signals } = state;

  // Total tokens consumed across all history entries
  let totalTokensConsumed = 0;
  for (const entry of history) {
    totalTokensConsumed += entry.tokensConsumed;
  }

  // Count mutations and reads
  let mutationCount = 0;
  let readCount = 0;
  let cacheHits = 0;

  const readFiles = new Set<string>();
  const mutatedFiles = new Set<string>();

  for (const entry of history) {
    const file = entry.args['file'] as string | undefined;

    if (MUTATION_TOOLS.has(entry.tool)) {
      mutationCount += 1;
      if (file) mutatedFiles.add(file);
    }

    if (READ_TOOLS.has(entry.tool)) {
      readCount += 1;
      if (file) readFiles.add(file);
      if (entry.tokensConsumed === 0) cacheHits += 1;
    }
  }

  const tokensPerMutation = mutationCount > 0
    ? totalTokensConsumed / mutationCount
    : Infinity;

  const readsPerMutation = mutationCount > 0
    ? readCount / mutationCount
    : Infinity;

  const cacheHitRate = readCount > 0
    ? cacheHits / readCount
    : 0;

  // Wasted reads: files that were read but never mutated
  let wastedReads = 0;
  for (const file of readFiles) {
    if (!mutatedFiles.has(file)) wastedReads += 1;
  }

  const complianceTotal = state.rewriteCompliance.followed + state.rewriteCompliance.ignored;
  const rewriteAcceptanceRate = complianceTotal > 0
    ? state.rewriteCompliance.followed / complianceTotal
    : 1;

  // Mutation safety: count files mutated without prior read evidence
  let mutationSafetyBlocks = 0;
  let staleEvidenceCatches = 0;
  const readBeforeMutation = new Set<string>();
  for (const entry of history) {
    const file = entry.args['file'] as string | undefined;
    if (READ_TOOLS.has(entry.tool) && file) readBeforeMutation.add(file);
    if (MUTATION_TOOLS.has(entry.tool) && file) {
      if (!readBeforeMutation.has(file)) mutationSafetyBlocks += 1;
      // After mutation, evidence is stale for subsequent mutations
      readBeforeMutation.delete(file);
    }
  }
  staleEvidenceCatches = state.staleReads.size;

  return {
    totalTokensConsumed,
    tokensPerMutation,
    readsPerMutation,
    reclassifications: 0,
    depthEscalations: signals.depthEscalations,
    cacheHitRate,
    starterPacketCoverage: 0,
    wastedReads,
    rewriteAcceptanceRate,
    mutationSafetyBlocks,
    staleEvidenceCatches,
    downgrades: { ...state.downgrades },
  };
}
