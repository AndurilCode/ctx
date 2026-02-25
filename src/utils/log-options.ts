import type { LogCustomRule } from '../types/log.js';

export function parseTimestampMode(value: unknown): 'auto' | 'strip' | 'keep' {
  const mode = String(value ?? 'auto').toLowerCase();
  if (mode === 'strip' || mode === 'keep' || mode === 'auto') return mode;
  return 'auto';
}

export function parseCliCustomRules(
  strip: unknown,
  fold: unknown,
  blockFold: unknown,
): LogCustomRule[] {
  const rules: LogCustomRule[] = [];

  for (const pattern of toPatterns(strip)) {
    rules.push({ type: 'strip', pattern });
  }

  for (const pattern of toPatterns(fold)) {
    rules.push({ type: 'fold', pattern, label: 'folded' });
  }

  for (const rule of toPatterns(blockFold)) {
    const [start, end] = rule.split('::');
    if (start && end) {
      rules.push({ type: 'block', start, end, label: 'block' });
    }
  }

  return rules;
}

function toPatterns(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => String(entry).split(','))
      .map((part) => part.trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  }

  return [];
}
