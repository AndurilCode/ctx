export type BundleType = 'starter' | 'working' | 'mutation-safety' | 'anchor';

export interface Bundle {
  type: BundleType;
  tokenBudget: number;
  files: string[];
  metadata: Record<string, unknown>;
}

export function createBundle(type: BundleType, tokenBudget: number): Bundle {
  return { type, tokenBudget, files: [], metadata: {} };
}
