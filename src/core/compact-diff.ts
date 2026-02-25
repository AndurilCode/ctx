import type { DiffCompactOptions } from '../types/diff.js';
import { compactUnifiedDiff } from '../utils/diff.js';

export function compactDiff(diff: string, options: DiffCompactOptions = {}): string {
  return compactUnifiedDiff(diff, options);
}
