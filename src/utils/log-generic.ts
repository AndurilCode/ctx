const DEBUG_LINE_RE = /\b(DEBUG|debug)\b/;
const HEALTH_RE = /\/(health|healthz|readyz|livez)\b/i;
const USER_AGENT_RE =
  /(Mozilla\/5\.0|AppleWebKit\/|Chrome\/\d+|Safari\/\d+|Firefox\/\d+|curl\/\d+)/;
const STARTUP_RE =
  /(Starting|Started|Booting|Initializing|Listening on|Migrations? complete|Ready in)\b/i;
const ERROR_START_RE = /^(Error|Caused by|Exception|Traceback|panic:)/;
const JSON_OBJECT_RE = /^\s*\{.*\}\s*$/;

export function foldDebugLines(lines: string[], appliedRules: string[]): string[] {
  let count = 0;
  const next = lines.filter((line) => {
    const isDebug = DEBUG_LINE_RE.test(line);
    if (isDebug) count++;
    return !isDebug;
  });

  if (count > 0) {
    next.unshift(`[debug lines stripped: ${count}]`);
    appliedRules.push('debug-fold');
  }

  return next;
}

export function elideHealthChecks(lines: string[], appliedRules: string[]): string[] {
  let count = 0;
  const next = lines.filter((line) => {
    const isHealth = HEALTH_RE.test(line);
    if (isHealth) count++;
    return !isHealth;
  });

  if (count > 0) {
    next.unshift(`[health checks stripped: ${count}]`);
    appliedRules.push('health-elision');
  }

  return next;
}

export function stripUserAgents(lines: string[], appliedRules: string[]): string[] {
  let changed = false;
  const next = lines.map((line) => {
    if (!USER_AGENT_RE.test(line)) return line;
    changed = true;
    return line.replace(
      /"[^"]*(Mozilla\/5\.0|AppleWebKit\/|Chrome\/\d+|Safari\/\d+|Firefox\/\d+)[^"]*"/g,
      '"<ua>"',
    );
  });

  if (changed) appliedRules.push('user-agent-strip');
  return next;
}

export function foldJsonLines(lines: string[], appliedRules: string[]): string[] {
  const jsonLines = lines.filter((line) => JSON_OBJECT_RE.test(line));
  if (jsonLines.length < 6) return lines;

  const buckets = { error: 0, warn: 0, info: 0, debug: 0, other: 0 };
  for (const line of jsonLines) {
    try {
      const parsed = JSON.parse(line) as { level?: string; severity?: string };
      const level = String(parsed.level ?? parsed.severity ?? '').toLowerCase();
      if (level.includes('error')) buckets.error++;
      else if (level.includes('warn')) buckets.warn++;
      else if (level.includes('info')) buckets.info++;
      else if (level.includes('debug')) buckets.debug++;
      else buckets.other++;
    } catch {
      buckets.other++;
    }
  }

  const keep = lines.filter((line) => !JSON_OBJECT_RE.test(line));
  keep.unshift(
    `[json lines folded: ${jsonLines.length} (error:${buckets.error}, warn:${buckets.warn}, info:${buckets.info}, debug:${buckets.debug}, other:${buckets.other})]`,
  );
  appliedRules.push('json-line-fold');
  return keep;
}

export function foldFrameworkStartup(lines: string[], appliedRules: string[]): string[] {
  if (lines.length < 10) return lines;
  let count = 0;
  const next: string[] = [];

  for (const line of lines) {
    const banner = /^\s*[=_\-]{5,}\s*$/.test(line) || /^\s*\|.*\|\s*$/.test(line);
    if (banner || STARTUP_RE.test(line)) {
      count++;
      continue;
    }
    next.push(line);
  }

  if (count > 3) {
    next.unshift(`[startup lines folded: ${count}]`);
    appliedRules.push('startup-fold');
    return next;
  }

  return lines;
}

export function dedupeStackTraces(lines: string[], appliedRules: string[]): string[] {
  const next: string[] = [];
  let cursor = 0;
  let changed = false;

  while (cursor < lines.length) {
    const line = lines[cursor] ?? '';
    if (!ERROR_START_RE.test(line)) {
      next.push(line);
      cursor++;
      continue;
    }

    const blockA = readStackBlock(lines, cursor);
    next.push(...blockA.lines);
    cursor = blockA.end;

    let repeats = 0;
    while (cursor < lines.length) {
      while (cursor < lines.length && (lines[cursor] ?? '') === '') {
        cursor++;
      }
      const probe = lines[cursor] ?? '';
      if (!ERROR_START_RE.test(probe)) break;
      const blockB = readStackBlock(lines, cursor);
      if (fingerprint(blockA.lines) !== fingerprint(blockB.lines)) break;
      repeats++;
      cursor = blockB.end;
    }

    if (repeats > 0) {
      changed = true;
      next.push(`[stack repeated ${repeats}x]`);
    }
  }

  if (changed) appliedRules.push('stack-dedup');
  return next;
}

function readStackBlock(lines: string[], start: number): { lines: string[]; end: number } {
  const out: string[] = [];
  let cursor = start;

  while (cursor < lines.length) {
    const line = lines[cursor] ?? '';
    if (cursor > start && line === '') break;
    if (cursor > start && ERROR_START_RE.test(line) && !line.startsWith('  ')) break;
    out.push(line);
    cursor++;
  }

  return { lines: out, end: cursor };
}

function fingerprint(lines: string[]): string {
  return lines
    .map((line) =>
      line
        .replace(/\b\d+\b/g, '#')
        .replace(/Retry\s+\d+\/\d+/gi, 'Retry #/#')
        .trim(),
    )
    .join('\n');
}
