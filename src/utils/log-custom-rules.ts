import type { LogCustomRule } from '../types/log.js';

export function applyCustomRules(
  lines: string[],
  rules: LogCustomRule[],
  appliedRules: string[],
): string[] {
  let current = lines;

  for (const rule of rules) {
    if (rule.type === 'strip') {
      const re = new RegExp(rule.pattern);
      const next = current.filter((line) => !re.test(line));
      if (next.length !== current.length) appliedRules.push(`custom-strip:${rule.pattern}`);
      current = next;
      continue;
    }

    if (rule.type === 'fold') {
      current = applyFoldRule(current, rule.pattern, rule.label, appliedRules);
      continue;
    }

    current = applyBlockRule(current, rule.start, rule.end, rule.label, appliedRules);
  }

  return current;
}

function applyFoldRule(
  lines: string[],
  pattern: string,
  label: string | undefined,
  appliedRules: string[],
): string[] {
  const re = new RegExp(pattern);
  const next: string[] = [];
  let index = 0;

  while (index < lines.length) {
    if (!re.test(lines[index] ?? '')) {
      next.push(lines[index] ?? '');
      index++;
      continue;
    }

    let count = 0;
    while (index < lines.length && re.test(lines[index] ?? '')) {
      count++;
      index++;
    }
    next.push(`[${label ?? 'folded'}: ${count} lines]`);
  }

  if (next.join('\n') !== lines.join('\n')) appliedRules.push(`custom-fold:${pattern}`);
  return next;
}

function applyBlockRule(
  lines: string[],
  startPattern: string,
  endPattern: string,
  label: string | undefined,
  appliedRules: string[],
): string[] {
  const start = new RegExp(startPattern);
  const end = new RegExp(endPattern);
  const next: string[] = [];

  for (let cursor = 0; cursor < lines.length; cursor++) {
    if (!start.test(lines[cursor] ?? '')) {
      next.push(lines[cursor] ?? '');
      continue;
    }

    let count = 1;
    while (++cursor < lines.length) {
      count++;
      if (end.test(lines[cursor] ?? '')) break;
    }
    next.push(`[${label ?? 'block'}: ${count} lines folded]`);
  }

  if (next.join('\n') !== lines.join('\n')) {
    appliedRules.push(`custom-block:${startPattern}..${endPattern}`);
  }

  return next;
}
