import type { HarnessState, InterceptedCall } from '../../types/harness.js';
import { MUTATION_TOOLS } from './constants.js';

export interface MutationCheck {
  safe: boolean;
  reason?: string;
  requiredReads?: InterceptedCall[];
}

/**
 * Check whether a mutation on `file` has valid read evidence.
 * Returns unsafe if the file was never read or if its evidence is stale.
 */
export function checkMutationEvidence(state: HarnessState, file: string): MutationCheck {
  if (!state.cache.filesRead.has(file)) {
    return {
      safe: false,
      reason: `No read evidence for ${file}. File must be read before mutation.`,
      requiredReads: [{ tool: 'read', args: { file } }],
    };
  }

  if (state.staleReads.has(file)) {
    const cached = state.cache.filesRead.get(file)!;
    return {
      safe: false,
      reason: `Read evidence for ${file} is stale (read on turn ${cached.turn}, mutated since). Re-read required.`,
      requiredReads: [{ tool: 'read', args: { file } }],
    };
  }

  return { safe: true };
}

/**
 * Mark a file's read evidence as stale after mutation.
 */
export function invalidateEvidence(state: HarnessState, file: string): void {
  if (state.cache.filesRead.has(file)) {
    state.staleReads.add(file);
  }
}

/**
 * Restore evidence for a file after a fresh read.
 */
export function restoreEvidence(state: HarnessState, file: string): void {
  state.staleReads.delete(file);
}

/**
 * Check if a tool call is a mutation that requires evidence.
 */
export function isMutationRequiringEvidence(tool: string): boolean {
  return MUTATION_TOOLS.has(tool) && tool !== 'bash';
}
