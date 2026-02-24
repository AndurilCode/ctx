import type { Root } from 'mdast';
import type { DedupCandidate } from './scanner.js';

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
): DedupEntry[] {
  const entries: DedupEntry[] = [];
  let nextId = 1;

  for (const candidate of candidates) {
    let token = `§${nextId}`;
    while (sourceText.includes(token) || entries.some((entry) => entry.token === token)) {
      nextId += 1;
      token = `§${nextId}`;
    }

    const referenceSavings = (candidate.value.length - token.length) * candidate.occurrences;
    const dictionaryCost = `${token}=${candidate.value}\n`.length;
    if (referenceSavings <= dictionaryCost) {
      nextId += 1;
      continue;
    }

    entries.push({ token, value: candidate.value });
    nextId += 1;
  }

  return entries;
}
