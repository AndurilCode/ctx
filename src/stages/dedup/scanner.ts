export interface DedupCandidate {
  value: string;
  occurrences: number;
  score: number;
}

const MIN_TERM_LENGTH = 6;
const MIN_OCCURRENCES = 3;
const WORD_PATTERN = /[A-Za-z0-9@._/-]{6,}/g;

function estimateScore(value: string, occurrences: number): number {
  // Assume 2-4 chars per token placeholder (e.g. §1, §12).
  const averageTokenLength = 3;
  return (value.length - averageTokenLength) * (occurrences - 1);
}

export function scanDedupCandidates(values: readonly string[]): DedupCandidate[] {
  const counts = new Map<string, number>();

  for (const value of values) {
    const matches = value.match(WORD_PATTERN);
    if (!matches) {
      continue;
    }

    for (const term of matches) {
      if (term.length < MIN_TERM_LENGTH) {
        continue;
      }
      counts.set(term, (counts.get(term) ?? 0) + 1);
    }
  }

  const candidates: DedupCandidate[] = [];
  for (const [value, occurrences] of counts) {
    if (occurrences < MIN_OCCURRENCES) {
      continue;
    }

    candidates.push({
      value,
      occurrences,
      score: estimateScore(value, occurrences),
    });
  }

  return candidates.sort((a, b) => b.score - a.score || b.value.length - a.value.length);
}
