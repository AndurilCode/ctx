export interface DedupCandidate {
  value: string;
  occurrences: number;
  /** Estimated token count of the original value. */
  tokenCost: number;
}

const MIN_OCCURRENCES = 2;
const MAX_NGRAM_WORDS = 5;
const MIN_NGRAM_WORDS = 2;
const SINGLE_WORD_MIN_LENGTH = 10;
const SINGLE_WORD_PATTERN = /[A-Za-z0-9@._/-]+/g;

function extractNgrams(text: string, n: number): Map<string, number> {
  const counts = new Map<string, number>();
  const sentences = text.split(/[.!?\n]+/);

  for (const sentence of sentences) {
    const words = sentence.split(/\s+/).filter((w) => w.length > 0);
    for (let i = 0; i <= words.length - n; i++) {
      const gram = words.slice(i, i + n).join(' ');
      counts.set(gram, (counts.get(gram) ?? 0) + 1);
    }
  }

  return counts;
}

/**
 * Estimates token count using a word-based heuristic that better
 * matches LLM tokenizer behavior than raw char-count division.
 * Most English words map to 1-2 BPE tokens; punctuation is ~1 token.
 */
export function estimateTokens(value: string): number {
  const words = value.split(/\s+/).filter((w) => w.length > 0);
  let tokens = 0;

  for (const word of words) {
    if (word.length <= 4) {
      tokens += 1;
    } else if (word.length <= 10) {
      tokens += 1;
    } else {
      tokens += Math.ceil(word.length / 6);
    }
  }

  return Math.max(1, tokens);
}

/** Token cost of a `§N` marker — always 2 tokens in major LLM tokenizers. */
export const MARKER_TOKEN_COST = 2;

function isSubstringOfAny(candidate: string, accepted: Set<string>): boolean {
  for (const existing of accepted) {
    if (existing !== candidate && existing.includes(candidate)) return true;
  }
  return false;
}

export function scanDedupCandidates(
  values: readonly string[],
  tokenEstimator: (v: string) => number = estimateTokens,
): DedupCandidate[] {
  const fullText = values.join('\n');
  const candidates: DedupCandidate[] = [];
  const accepted = new Set<string>();

  for (let n = MAX_NGRAM_WORDS; n >= MIN_NGRAM_WORDS; n--) {
    const counts = extractNgrams(fullText, n);

    for (const [phrase, occurrences] of counts) {
      if (occurrences < MIN_OCCURRENCES) continue;

      const tokenCost = tokenEstimator(phrase);
      if (tokenCost <= MARKER_TOKEN_COST) continue;

      if (isSubstringOfAny(phrase, accepted)) continue;

      accepted.add(phrase);
      candidates.push({ value: phrase, occurrences, tokenCost });
    }
  }

  const singleWords = new Map<string, number>();
  for (const value of values) {
    const matches = value.match(SINGLE_WORD_PATTERN);
    if (!matches) continue;
    for (const term of matches) {
      if (term.length < SINGLE_WORD_MIN_LENGTH) continue;
      singleWords.set(term, (singleWords.get(term) ?? 0) + 1);
    }
  }

  for (const [term, occurrences] of singleWords) {
    if (occurrences < MIN_OCCURRENCES) continue;
    if (accepted.has(term)) continue;

    const tokenCost = tokenEstimator(term);
    if (tokenCost <= MARKER_TOKEN_COST) continue;

    if (isSubstringOfAny(term, accepted)) continue;

    accepted.add(term);
    candidates.push({ value: term, occurrences, tokenCost });
  }

  return candidates.sort(
    (a, b) =>
      (b.tokenCost - MARKER_TOKEN_COST) * b.occurrences -
      (a.tokenCost - MARKER_TOKEN_COST) * a.occurrences,
  );
}
