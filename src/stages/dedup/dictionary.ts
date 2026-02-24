import type { Root } from 'mdast';
import type { DedupCandidate } from './scanner.js';
import { MARKER_TOKEN_COST } from './scanner.js';

export interface DedupEntry {
  token: string;
  value: string;
}

type RootWithDedupData = Root & {
  data?: {
    compactDedupDictionary?: DedupEntry[];
  };
};

export function getDedupDictionary(tree: Root): DedupEntry[] {
  return ((tree as RootWithDedupData).data?.compactDedupDictionary ?? []).map((entry) => ({
    token: entry.token,
    value: entry.value,
  }));
}

export function setDedupDictionary(tree: Root, entries: readonly DedupEntry[]): void {
  const root = tree as RootWithDedupData;
  if (!root.data) {
    root.data = {};
  }
  root.data.compactDedupDictionary = [...entries];
}

export function buildDedupDictionary(
  candidates: readonly DedupCandidate[],
  sourceText: string,
  tokenEstimator: (v: string) => number,
): DedupEntry[] {
  const entries: DedupEntry[] = [];
  let nextId = 1;

  for (const candidate of candidates) {
    let token = `§${nextId}`;
    while (sourceText.includes(token) || entries.some((entry) => entry.token === token)) {
      nextId += 1;
      token = `§${nextId}`;
    }

    const savingsPerOccurrence = candidate.tokenCost - MARKER_TOKEN_COST;
    if (savingsPerOccurrence <= 0) {
      nextId += 1;
      continue;
    }

    const totalReplacementSavings = savingsPerOccurrence * candidate.occurrences;
    const dictLineTokenCost = tokenEstimator(`${token}=${candidate.value}\n`);

    if (totalReplacementSavings <= dictLineTokenCost) {
      nextId += 1;
      continue;
    }

    entries.push({ token, value: candidate.value });
    nextId += 1;
  }

  return entries;
}
