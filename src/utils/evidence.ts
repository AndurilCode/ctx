import { readFile } from 'node:fs/promises';
import type { EvidenceLine } from '../types/review.js';

/**
 * Extract line-anchored evidence for matched risk terms from a file.
 * Returns lines containing any of the matched terms (case-insensitive).
 * Lines are labeled as "relevant" — not necessarily root cause.
 */
export async function extractEvidence(file: string, matchedTerms: string[]): Promise<EvidenceLine[]> {
  let content: string;
  try {
    content = await readFile(file, 'utf8');
  } catch {
    return [];
  }
  const lines = content.split('\n');
  const evidence: EvidenceLine[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const lineLower = line.toLowerCase();
    for (const term of matchedTerms) {
      if (lineLower.includes(term)) {
        evidence.push({ lineNumber: i + 1, content: line.trimEnd(), matchedTerm: term });
        break; // one entry per line; first matching term wins
      }
    }
  }
  return evidence;
}
