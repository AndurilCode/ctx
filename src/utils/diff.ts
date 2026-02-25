import type { DiffCompactOptions } from '../types/diff.js';

interface Hunk {
  header: string;
  lines: string[];
}

interface DiffFile {
  headerLines: string[];
  hunks: Hunk[];
  fallbackPath: string;
}

const DEFAULT_OPTIONS: Required<DiffCompactOptions> = {
  context: 1,
  compactHeaders: true,
  changesOnly: false,
};

export function compactUnifiedDiff(diff: string, options: DiffCompactOptions = {}): string {
  const merged: Required<DiffCompactOptions> = {
    context: options.context ?? DEFAULT_OPTIONS.context,
    compactHeaders: options.compactHeaders ?? DEFAULT_OPTIONS.compactHeaders,
    changesOnly: options.changesOnly ?? DEFAULT_OPTIONS.changesOnly,
  };
  const context = Number.isFinite(merged.context)
    ? Math.max(0, Math.floor(merged.context))
    : DEFAULT_OPTIONS.context;

  const files = parseDiffFiles(diff);
  const chunks = merged.changesOnly
    ? files.map((file) => renderChangesOnly(file))
    : files.map((file) => renderFile(file, context, merged.compactHeaders));

  const output = chunks.filter((chunk) => chunk.length > 0).join('\n');
  if (!output) return '';
  return diff.endsWith('\n') ? `${output}\n` : output;
}

function parseDiffFiles(diff: string): DiffFile[] {
  const lines = diff.split(/\r?\n/);
  if (lines.length > 0 && lines.at(-1) === '') {
    lines.pop();
  }

  const files: DiffFile[] = [];
  let current: DiffFile | null = null;
  let currentHunk: Hunk | null = null;

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      current = { headerLines: [line], hunks: [], fallbackPath: parseDiffGitPath(line) };
      files.push(current);
      currentHunk = null;
      continue;
    }

    if (!current) {
      current = { headerLines: [], hunks: [], fallbackPath: '' };
      files.push(current);
    }

    if (line.startsWith('@@ ')) {
      currentHunk = { header: line, lines: [] };
      current.hunks.push(currentHunk);
      continue;
    }

    if (currentHunk) {
      currentHunk.lines.push(line);
      continue;
    }

    current.headerLines.push(line);
  }

  return files;
}

function renderFile(file: DiffFile, context: number, compactHeaders: boolean): string {
  const lines: string[] = [];

  if (compactHeaders) {
    const path = resolveFilePath(file.headerLines, file.fallbackPath);
    if (path) {
      lines.push(`=== ${path}`);
    }

    for (const headerLine of file.headerLines) {
      if (
        headerLine.startsWith('diff --git ') ||
        headerLine.startsWith('index ') ||
        headerLine.startsWith('--- ') ||
        headerLine.startsWith('+++ ')
      ) {
        continue;
      }
      lines.push(headerLine);
    }
  } else {
    lines.push(...file.headerLines);
  }

  for (const hunk of file.hunks) {
    lines.push(hunk.header);
    lines.push(...reduceContext(hunk.lines, context));
  }

  return trimEdgeBlankLines(lines).join('\n');
}

function renderChangesOnly(file: DiffFile): string {
  const lines: string[] = [];
  const path = resolveFilePath(file.headerLines, file.fallbackPath);

  if (path) {
    lines.push(`--- ${path}`);
  }

  for (const hunk of file.hunks) {
    const label = extractHunkLabel(hunk.header);
    if (label) {
      lines.push(`@@ ${label}`);
    }

    for (const line of hunk.lines) {
      if (line.startsWith('+') || line.startsWith('-') || line.startsWith('\\ ')) {
        lines.push(line);
      }
    }
  }

  return trimEdgeBlankLines(lines).join('\n');
}

function resolveFilePath(headerLines: readonly string[], fallbackPath: string): string {
  const plusLine = headerLines.find((line) => line.startsWith('+++ '));
  const minusLine = headerLines.find((line) => line.startsWith('--- '));

  const plusPath = plusLine ? normalizeDiffPath(plusLine.slice(4)) : '';
  const minusPath = minusLine ? normalizeDiffPath(minusLine.slice(4)) : '';

  if (plusPath && plusPath !== '/dev/null') return plusPath;
  if (minusPath && minusPath !== '/dev/null') return minusPath;
  return fallbackPath;
}

function reduceContext(lines: readonly string[], context: number): string[] {
  if (context === 0) {
    return lines.filter((line) => !line.startsWith(' '));
  }

  const keep = new Set<number>();
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (line === undefined) {
      continue;
    }
    if (line.startsWith('+') || line.startsWith('-') || line.startsWith('\\ ')) {
      const start = Math.max(0, index - context);
      const end = Math.min(lines.length - 1, index + context);
      for (let cursor = start; cursor <= end; cursor++) {
        keep.add(cursor);
      }
    }
  }

  return lines.filter((_, index) => keep.has(index));
}

function parseDiffGitPath(line: string): string {
  const parts = line.trim().split(/\s+/);
  const candidate = parts[3] ?? '';
  return normalizeDiffPath(candidate);
}

function normalizeDiffPath(path: string): string {
  if (path.startsWith('a/') || path.startsWith('b/')) {
    return path.slice(2);
  }

  return path;
}

function extractHunkLabel(header: string): string {
  const match = header.match(/^@@\s+[-+,\d\s]+@@\s*(.*)$/);
  return match?.[1]?.trim() ?? '';
}

function trimEdgeBlankLines(lines: string[]): string[] {
  while (lines[0] === '') lines.shift();
  while (lines.at(-1) === '') lines.pop();
  return lines;
}
