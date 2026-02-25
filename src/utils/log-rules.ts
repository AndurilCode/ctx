export const ANSI_RE = /\u001B\[[0-9;]*[a-zA-Z]/g;
export const OSC_RE = /\u001B\][^\u0007]*\u0007/g;
export const CARRIAGE_RE = /\r(?!\n)/g;

const TIMESTAMP_PATTERNS = [
  { name: 'iso', re: /^\[?\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?\]?\s*/ },
  { name: 'syslog', re: /^[A-Z][a-z]{2}\s+\d+\s+\d{2}:\d{2}:\d{2}\s+/ },
  { name: 'epoch', re: /^\d{10,13}\s+/ },
];

const PROGRESS_LINE_RE =
  /(^\s*(Downloading|Uploading|Installing|Building).+\d+%|[█▓░━⣾⠿]|\b\d+%\b|^\s*\[[-= >]+\])/;

export function splitLines(text: string): string[] {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/[ \t]+$/g, ''));
  while (lines.length > 0 && lines.at(-1) === '') lines.pop();
  return lines;
}

export function foldProgressLines(lines: string[], appliedRules: string[]): string[] {
  const next: string[] = [];
  let index = 0;
  let changed = false;

  while (index < lines.length) {
    if (!PROGRESS_LINE_RE.test(lines[index] ?? '')) {
      next.push(lines[index] ?? '');
      index++;
      continue;
    }

    let count = 1;
    let last = lines[index] ?? '';
    index++;
    while (index < lines.length && PROGRESS_LINE_RE.test(lines[index] ?? '')) {
      count++;
      last = lines[index] ?? '';
      index++;
    }

    next.push(last);
    if (count > 1) {
      next.push(`[progress: ${count - 1} lines collapsed]`);
      changed = true;
    }
  }

  if (changed) appliedRules.push('progress-fold');
  return next;
}

export function stripTimestamps(
  lines: string[],
  mode: 'auto' | 'strip' | 'keep',
  appliedRules: string[],
): string[] {
  if (mode === 'keep' || lines.length === 0) return lines;

  const candidate = TIMESTAMP_PATTERNS.map((pattern) => ({
    ...pattern,
    matches: lines.filter((line) => pattern.re.test(line)).length,
  })).sort((a, b) => b.matches - a.matches)[0];

  if (!candidate || candidate.matches === 0) return lines;
  if (mode === 'auto' && candidate.matches / lines.length < 0.8) return lines;

  const stripped = lines.map((line) => line.replace(candidate.re, ''));
  appliedRules.push(`timestamp-strip:${candidate.name}`);
  return [`[timestamps stripped: ${candidate.name}]`, ...stripped];
}

export function foldConsecutiveRepeats(lines: string[], appliedRules: string[]): string[] {
  if (lines.length < 2) return lines;

  const next: string[] = [];
  let changed = false;
  let index = 0;

  while (index < lines.length) {
    const base = lines[index] ?? '';
    const normalized = normalizeLine(base);
    let count = 1;
    let cursor = index + 1;

    while (cursor < lines.length && normalizeLine(lines[cursor] ?? '') === normalized) {
      count++;
      cursor++;
    }

    next.push(base);
    if (count > 1 && normalized.length > 0) {
      next.push(`[repeated ${count - 1}x]`);
      changed = true;
    }
    index = cursor;
  }

  if (changed) appliedRules.push('repeat-fold');
  return next;
}

export function foldGlobalRepeats(lines: string[], appliedRules: string[]): string[] {
  const counts = new Map<string, number>();
  for (const line of lines) {
    const key = normalizeLine(line);
    if (!key || key.length < 12) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const target = new Set(
    Array.from(counts.entries())
      .filter(([, c]) => c >= 3)
      .map(([k]) => k),
  );
  if (target.size === 0) return lines;

  const seen = new Set<string>();
  let folded = 0;
  const next = lines.filter((line) => {
    const key = normalizeLine(line);
    if (!target.has(key)) return true;
    if (!seen.has(key)) {
      seen.add(key);
      return true;
    }
    folded++;
    return false;
  });

  if (folded > 0) {
    next.push(`[global repeats folded: ${folded}]`);
    appliedRules.push('global-repeat-fold');
  }
  return next;
}

export function collapseBlankLines(lines: string[], appliedRules: string[]): string[] {
  const next: string[] = [];
  let blankRun = 0;
  let changed = false;

  for (const line of lines) {
    if (line === '') {
      blankRun++;
      if (blankRun <= 1) next.push('');
      else changed = true;
      continue;
    }

    blankRun = 0;
    next.push(line);
  }

  if (changed) appliedRules.push('blank-collapse');
  return next;
}

function normalizeLine(line: string): string {
  return line
    .replace(/\b\d+\b/g, '#')
    .replace(/[a-f0-9]{7,40}/gi, '<hash>')
    .replace(/0x[0-9a-f]+/gi, '0x#')
    .trim();
}
