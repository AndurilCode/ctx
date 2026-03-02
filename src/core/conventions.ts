import { stat } from 'node:fs/promises';
import { extname, relative, resolve } from 'node:path';
import fg from 'fast-glob';
import type {
  ConventionSignal,
  ConventionsOptions,
  ConventionsResult,
} from '../types/conventions.js';
import { readFileText } from '../utils/file-reader.js';
import { hashString } from '../utils/hash.js';
import { codeOutline } from './code-outline.js';

const DEFAULT_MAX_FILES = 10;
const DEFAULT_THRESHOLD = 0.7;
const cache = new Map<string, ConventionsResult>();

interface SampleFile {
  rel: string;
  abs: string;
  size: number;
}

interface FileStats {
  importCount: number;
  relativeImportCount: number;
  jsExtImportCount: number;
  typeImportCount: number;
  exportCount: number;
  namedExportCount: number;
  defaultExportCount: number;
  tryCount: number;
  throwCount: number;
  functionCount: number;
  totalFunctionLines: number;
  explicitReturnCount: number;
  explicitVoidReturnCount: number;
  promiseReturnCount: number;
  namingCounts: Record<'camel' | 'pascal' | 'snake' | 'other', number>;
  isTestPath: boolean;
}

function ratio(part: number, total: number): number {
  if (total <= 0) return 0;
  return part / total;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function namingStyle(name: string): 'camel' | 'pascal' | 'snake' | 'other' {
  if (/^[a-z][a-zA-Z0-9]*$/.test(name)) return 'camel';
  if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) return 'pascal';
  if (/^[a-z][a-z0-9_]*$/.test(name) && name.includes('_')) return 'snake';
  return 'other';
}

function normalizeIdentifier(raw: string): string | undefined {
  const match =
    raw.match(/\bconst\s+([A-Za-z_][A-Za-z0-9_]*)/) ??
    raw.match(/\blet\s+([A-Za-z_][A-Za-z0-9_]*)/) ??
    raw.match(/\bvar\s+([A-Za-z_][A-Za-z0-9_]*)/) ??
    raw.match(/\bfunction\s+([A-Za-z_][A-Za-z0-9_]*)/) ??
    raw.match(/^([A-Za-z_][A-Za-z0-9_]*)$/);
  return match?.[1];
}

function hasTestPath(pathValue: string): boolean {
  return /(^|\/)(__tests__|tests?|specs?)(\/|$)|\.(test|spec)\./i.test(pathValue);
}

function sectionHeader(directory: string): string {
  return `── conventions (${directory}/) ───────────────────────`;
}

function dominantStyle(
  counts: Record<'camel' | 'pascal' | 'snake' | 'other', number>,
): { label: 'camel' | 'pascal' | 'snake' | 'other'; confidence: number } {
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]) as Array<
    ['camel' | 'pascal' | 'snake' | 'other', number]
  >;
  const total = counts.camel + counts.pascal + counts.snake + counts.other;
  const top = sorted[0];
  if (!top) return { label: 'other', confidence: 0 };
  return { label: top[0], confidence: ratio(top[1], total) };
}

function styleLabel(style: 'camel' | 'pascal' | 'snake' | 'other'): string {
  if (style === 'camel') return 'camelCase';
  if (style === 'pascal') return 'PascalCase';
  if (style === 'snake') return 'snake_case';
  return 'mixed';
}

function parseExplicitReturn(signature?: string): {
  explicit: boolean;
  isVoid: boolean;
  isPromise: boolean;
} {
  if (!signature) return { explicit: false, isVoid: false, isPromise: false };
  const explicit = /\)\s*:\s*[^=]/.test(signature) || /->\s*[^=]/.test(signature);
  if (!explicit) return { explicit: false, isVoid: false, isPromise: false };
  return {
    explicit: true,
    isVoid: /\bvoid\b/.test(signature),
    isPromise: /\bPromise\s*</.test(signature),
  };
}

async function sampleFiles(directory: string, maxFiles: number): Promise<SampleFile[]> {
  const absDirectory = resolve(directory);
  const extensionFilter = extname(absDirectory);
  const files = await fg('**/*.{ts,tsx,js,jsx}', {
    cwd: absDirectory,
    absolute: true,
    ignore: ['node_modules/**', 'dist/**', '.git/**'],
  });

  const sampled: SampleFile[] = [];
  for (const file of files) {
    if (extensionFilter && extname(file) !== extensionFilter) continue;
    try {
      const fileStat = await stat(file);
      sampled.push({
        rel: relative(resolve('.'), file),
        abs: file,
        size: fileStat.size,
      });
    } catch {
      // Ignore unreadable files.
    }
  }

  sampled.sort((a, b) => b.size - a.size);
  return sampled.slice(0, maxFiles);
}

async function collectStats(target: SampleFile): Promise<FileStats | undefined> {
  let content: string;
  try {
    content = await readFileText(target.abs);
  } catch {
    return undefined;
  }

  const importLines = content.match(/^\s*import\s+.+$/gm) ?? [];
  const exportLines = content.match(/^\s*export\s+.+$/gm) ?? [];

  const stats: FileStats = {
    importCount: importLines.length,
    relativeImportCount: 0,
    jsExtImportCount: 0,
    typeImportCount: 0,
    exportCount: exportLines.length,
    namedExportCount: 0,
    defaultExportCount: 0,
    tryCount: (content.match(/\btry\s*\{/g) ?? []).length,
    throwCount: (content.match(/\bthrow\s+new\b/g) ?? []).length,
    functionCount: 0,
    totalFunctionLines: 0,
    explicitReturnCount: 0,
    explicitVoidReturnCount: 0,
    promiseReturnCount: 0,
    namingCounts: { camel: 0, pascal: 0, snake: 0, other: 0 },
    isTestPath: hasTestPath(target.rel),
  };

  for (const line of importLines) {
    if (/from\s+['"]\.\.?\//.test(line)) stats.relativeImportCount += 1;
    if (/\.js['"]/.test(line)) stats.jsExtImportCount += 1;
    if (/^\s*import\s+type\s+/.test(line)) stats.typeImportCount += 1;
  }

  for (const line of exportLines) {
    if (/\bdefault\b/.test(line)) stats.defaultExportCount += 1;
    else stats.namedExportCount += 1;
  }

  try {
    const outlined = await codeOutline(content, { filePath: target.abs });
    const stack = [...outlined.nodes];
    while (stack.length > 0) {
      const node = stack.pop();
      if (!node) continue;
      if (node.kind === 'function' || node.kind === 'method') {
        stats.functionCount += 1;
        stats.totalFunctionLines += Math.max(1, node.endLine - node.startLine + 1);
        const identifier = normalizeIdentifier(node.name);
        if (identifier) {
          const style = namingStyle(identifier);
          stats.namingCounts[style] += 1;
        }
        const parsedReturn = parseExplicitReturn(node.signature);
        if (parsedReturn.explicit) {
          stats.explicitReturnCount += 1;
          if (parsedReturn.isVoid) stats.explicitVoidReturnCount += 1;
          if (parsedReturn.isPromise) stats.promiseReturnCount += 1;
        }
      } else if (node.kind === 'class' || node.kind === 'interface' || node.kind === 'type') {
        const identifier = normalizeIdentifier(node.name);
        if (identifier) {
          const style = namingStyle(identifier);
          stats.namingCounts[style] += 1;
        }
      }
      if (node.children) stack.push(...node.children);
    }
  } catch {
    // Skip parse-derived metrics for unsupported or invalid files.
  }

  return stats;
}

export async function conventions(options: ConventionsOptions): Promise<ConventionsResult> {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const maxFiles = Math.max(3, options.maxFiles ?? DEFAULT_MAX_FILES);
  const absDirectory = resolve(options.directory);
  const directory = relative(resolve('.'), absDirectory) || '.';
  const targets = await sampleFiles(absDirectory, maxFiles);

  if (targets.length < 3) {
    return {
      directory,
      sampledFiles: targets.length,
      signals: [],
      output: `${sectionHeader(directory)}\ninsufficient parseable files`,
    };
  }

  const cacheKey = hashString(
    `${absDirectory}:${maxFiles}:${threshold}:${targets.map((f) => `${f.rel}:${f.size}`).join('|')}`,
  );
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const statsList = (await Promise.all(targets.map((target) => collectStats(target)))).filter(
    (value): value is FileStats => value !== undefined,
  );

  const signals: ConventionSignal[] = [];

  const eligibleError = statsList.filter((s) => s.tryCount + s.throwCount >= 2);
  const dominantError = eligibleError.filter(
    (s) => ratio(s.tryCount, s.tryCount + s.throwCount) >= threshold && s.tryCount > 0,
  );
  const errorConfidence = ratio(dominantError.length, eligibleError.length);
  if (eligibleError.length >= 3 && errorConfidence >= threshold) {
    signals.push({
      key: 'errors',
      detail: 'try/catch style dominant, limited bare throws',
      confidence: errorConfidence,
    });
  }

  const eligibleReturns = statsList.filter((s) => s.explicitReturnCount >= 3);
  const dominantPromise = eligibleReturns.filter(
    (s) => ratio(s.promiseReturnCount, s.explicitReturnCount) >= threshold,
  );
  const promiseConfidence = ratio(dominantPromise.length, eligibleReturns.length);
  if (eligibleReturns.length >= 3 && promiseConfidence >= threshold) {
    signals.push({
      key: 'returns',
      detail: 'Promise-returning public functions are dominant',
      confidence: promiseConfidence,
    });
  } else {
    const dominantNonVoid = eligibleReturns.filter(
      (s) => ratio(s.explicitReturnCount - s.explicitVoidReturnCount, s.explicitReturnCount) >= threshold,
    );
    const nonVoidConfidence = ratio(dominantNonVoid.length, eligibleReturns.length);
    if (eligibleReturns.length >= 3 && nonVoidConfidence >= threshold) {
      signals.push({
        key: 'returns',
        detail: 'non-void return signatures dominate',
        confidence: nonVoidConfidence,
      });
    }
  }

  const eligibleNaming = statsList
    .map((s) => {
      const total =
        s.namingCounts.camel + s.namingCounts.pascal + s.namingCounts.snake + s.namingCounts.other;
      if (total < 4) return undefined;
      const dominant = dominantStyle(s.namingCounts);
      if (dominant.confidence < threshold) return undefined;
      return dominant.label;
    })
    .filter((value): value is 'camel' | 'pascal' | 'snake' | 'other' => value !== undefined);

  if (eligibleNaming.length >= 3) {
    const styleCounts = { camel: 0, pascal: 0, snake: 0, other: 0 } as Record<
      'camel' | 'pascal' | 'snake' | 'other',
      number
    >;
    for (const style of eligibleNaming) styleCounts[style] += 1;
    const top = dominantStyle(styleCounts);
    if (top.confidence >= threshold) {
      signals.push({
        key: 'naming',
        detail: `${styleLabel(top.label)} identifiers dominate`,
        confidence: top.confidence,
      });
    }
  }

  const eligibleImports = statsList.filter((s) => s.importCount >= 2);
  const relativeImportConfidence = ratio(
    eligibleImports.filter((s) => ratio(s.relativeImportCount, s.importCount) >= threshold).length,
    eligibleImports.length,
  );
  if (eligibleImports.length >= 3 && relativeImportConfidence >= threshold) {
    signals.push({
      key: 'imports',
      detail: 'relative imports are dominant',
      confidence: relativeImportConfidence,
    });
  }

  const jsImportConfidence = ratio(
    eligibleImports.filter((s) => ratio(s.jsExtImportCount, s.importCount) >= threshold).length,
    eligibleImports.length,
  );
  if (eligibleImports.length >= 3 && jsImportConfidence >= threshold) {
    signals.push({
      key: 'imports',
      detail: '.js import extensions are consistently used',
      confidence: jsImportConfidence,
    });
  }

  const typeImportConfidence = ratio(
    eligibleImports.filter((s) => ratio(s.typeImportCount, s.importCount) >= threshold).length,
    eligibleImports.length,
  );
  if (eligibleImports.length >= 3 && typeImportConfidence >= threshold) {
    signals.push({
      key: 'imports',
      detail: '`import type` separation is common',
      confidence: typeImportConfidence,
    });
  }

  const totalFunctions = statsList.reduce((sum, s) => sum + s.functionCount, 0);
  const filesWithFunctions = statsList.filter((s) => s.functionCount > 0).length;
  if (totalFunctions >= 5 && filesWithFunctions >= 3) {
    const avgLines = Math.round(
      statsList.reduce((sum, s) => sum + s.totalFunctionLines, 0) / totalFunctions,
    );
    const styleConfidence = ratio(filesWithFunctions, statsList.length);
    if (styleConfidence >= threshold) {
      signals.push({
        key: 'style',
        detail: `avg ${avgLines} lines/function`,
        confidence: styleConfidence,
      });
    }
  }

  const eligibleExports = statsList.filter((s) => s.exportCount >= 2);
  const namedExportConfidence = ratio(
    eligibleExports.filter((s) => ratio(s.namedExportCount, s.exportCount) >= threshold).length,
    eligibleExports.length,
  );
  if (eligibleExports.length >= 3 && namedExportConfidence >= threshold) {
    signals.push({
      key: 'exports',
      detail: 'named exports dominate',
      confidence: namedExportConfidence,
    });
  }

  const testPathConfidence = ratio(
    statsList.filter((s) => s.isTestPath).length,
    statsList.length,
  );
  if (statsList.length >= 3 && testPathConfidence >= threshold) {
    signals.push({
      key: 'tests',
      detail: 'test/spec file layout is common nearby',
      confidence: testPathConfidence,
    });
  }

  const lines = [sectionHeader(directory)];
  if (signals.length === 0) lines.push('no high-confidence conventions detected');
  else {
    for (const signal of signals) {
      lines.push(`${signal.key}: ${signal.detail} (${formatPercent(signal.confidence)})`);
    }
  }

  const result: ConventionsResult = {
    directory,
    sampledFiles: statsList.length,
    signals,
    output: lines.join('\n'),
  };
  cache.set(cacheKey, result);
  return result;
}

export function _resetConventionsCacheForTesting(): void {
  cache.clear();
}
