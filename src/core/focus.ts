import { dirname, relative, resolve } from 'node:path';
import type { FocusDependency, FocusOptions, FocusResult, FocusSection, FocusTypeRef } from '../types/focus.js';
import type { OutlineNode } from '../types/outline.js';
import type { SymbolDefinition, SymbolUsage } from '../types/symbols.js';
import { readFileText } from '../utils/file-reader.js';
import { findUsagesInContent } from '../utils/symbol-index.js';
import { createTokenCounter } from '../utils/tokens.js';
import { codeOutline } from './code-outline.js';
import { conventions } from './conventions.js';
import { fileImports } from './imports.js';
import { symbols } from './symbols.js';

const DEFAULT_MAX_TOKENS = 2000;
const DEFAULT_INCLUDE: FocusSection[] = ['body', 'callers', 'deps', 'types', 'tests', 'conventions'];

const JS_KEYWORDS = new Set([
  'if',
  'for',
  'while',
  'switch',
  'catch',
  'return',
  'function',
  'new',
  'typeof',
  'await',
  'import',
  'export',
]);

function flattenNodes(nodes: OutlineNode[]): OutlineNode[] {
  const out: OutlineNode[] = [];
  const stack = [...nodes];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;
    out.push(node);
    if (node.children) stack.push(...node.children);
  }
  return out;
}

function truncateByTokens(content: string, maxTokens: number): string {
  if (maxTokens <= 0) return '';
  const words = content.split(/\s+/);
  if (words.length <= maxTokens) return content;
  return `${words.slice(0, maxTokens).join(' ')}\n...`;
}

function hasTestPath(pathValue: string): boolean {
  return /(^|\/)(__tests__|tests?|specs?)(\/|$)|\.(test|spec)\./i.test(pathValue);
}

function parseTypeRefs(input?: string): string[] {
  if (!input) return [];
  const refs = new Set<string>();
  const colonMatches = input.matchAll(/:\s*([A-Z][A-Za-z0-9_]+)/g);
  for (const m of colonMatches) if (m[1]) refs.add(m[1]);
  const genericMatches = input.matchAll(/<\s*([A-Z][A-Za-z0-9_]+)\s*>/g);
  for (const m of genericMatches) if (m[1]) refs.add(m[1]);
  return [...refs];
}

function parseDependencyNames(body: string, symbol: string): string[] {
  const refs = new Set<string>();
  const matches = body.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g);
  for (const m of matches) {
    const name = m[1];
    if (!name || name === symbol || JS_KEYWORDS.has(name)) continue;
    refs.add(name);
    if (refs.size >= 12) break;
  }
  return [...refs];
}

async function resolveDefinitions(names: string[], root: string): Promise<Map<string, SymbolDefinition | undefined>> {
  const map = new Map<string, SymbolDefinition | undefined>();
  for (const name of names) {
    try {
      const result = await symbols({ query: name, path: root });
      map.set(name, result.definitions[0]);
    } catch {
      map.set(name, undefined);
    }
  }
  return map;
}

export async function focus(options: FocusOptions): Promise<FocusResult> {
  const include = options.include?.length ? options.include : DEFAULT_INCLUDE;
  const includeSet = new Set(include);
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  const root = resolve(options.root ?? '.');
  const absFile = resolve(root, options.file);
  const relFile = relative(resolve('.'), absFile);
  const source = await readFileText(absFile);
  const outlined = await codeOutline(source, { filePath: absFile });
  const nodes = flattenNodes(outlined.nodes);
  const candidates = nodes.filter((n) => n.name === options.symbol);
  const selected = candidates.find((n) => (options.hash ? n.hash === options.hash : true));

  if (!selected) {
    return {
      file: relFile,
      symbol: options.symbol,
      sections: include,
      output: `focus: symbol not found (${options.symbol})\n\n${outlined.output}`,
    };
  }

  const body = selected.startIndex !== undefined && selected.endIndex !== undefined
    ? source.slice(selected.startIndex, selected.endIndex)
    : undefined;

  const result: FocusResult = {
    file: relFile,
    symbol: selected.name,
    hash: selected.hash,
    kind: selected.kind,
    range: { startLine: selected.startLine, endLine: selected.endLine },
    sections: include,
    output: '',
  };

  const lines: string[] = [
    `focus: ${selected.name} (${selected.kind}, ${relFile}:${selected.startLine}-${selected.endLine}${selected.hash ? `, hash:${selected.hash}` : ''})`,
  ];

  if (includeSet.has('body')) {
    const bodyBudget = Math.max(40, Math.floor(maxTokens * 0.6));
    const bodyText = body ?? selected.signature ?? '<body unavailable>';
    const counter = await createTokenCounter();
    const bodyTokens = counter.count(bodyText);
    const renderedBody = bodyTokens > bodyBudget ? truncateByTokens(bodyText, bodyBudget) : bodyText;
    result.body = renderedBody;
    lines.push('', `── body (${Math.min(bodyTokens, bodyBudget)}t) ──────────────────────────────────`, renderedBody);
  }

  if (includeSet.has('callers')) {
    const allUsages = await symbols({ query: selected.name, path: root });
    const callers = allUsages.usages
      .filter((usage) => usage.file !== relFile || usage.line < selected.startLine || usage.line > selected.endLine)
      .slice(0, 20);
    result.callers = callers;
    lines.push('', `── callers (${callers.length}) ───────────────────────────────────`);
    if (callers.length === 0) lines.push('none');
    for (const caller of callers) {
      lines.push(`${caller.file}:${caller.line}  ${caller.context}`);
    }
  }

  if (includeSet.has('deps')) {
    const depNames = body ? parseDependencyNames(body, selected.name) : [];
    const depDefs = await resolveDefinitions(depNames, root);
    const deps: FocusDependency[] = depNames.map((name) => ({ name, definition: depDefs.get(name) }));
    result.dependencies = deps;
    lines.push('', `── dependencies (${deps.length}) ──────────────────────────────`);
    if (deps.length === 0) lines.push('none');
    for (const dep of deps) {
      if (dep.definition) {
        lines.push(
          `${dep.name}  -> ${dep.definition.file}:${dep.definition.startLine}-${dep.definition.endLine} (${dep.definition.kind})`,
        );
      } else {
        lines.push(`${dep.name}  -> unresolved`);
      }
    }
  }

  if (includeSet.has('types')) {
    const refs = parseTypeRefs(selected.signature);
    const refDefs = await resolveDefinitions(refs, root);
    const typeRefs: FocusTypeRef[] = refs.map((name) => ({ name, definition: refDefs.get(name) }));
    result.types = typeRefs;
    lines.push('', `── types (${typeRefs.length}) ───────────────────────────────`);
    if (typeRefs.length === 0) lines.push('none');
    for (const ref of typeRefs) {
      if (ref.definition) {
        lines.push(
          `${ref.name}  -> ${ref.definition.file}:${ref.definition.startLine}-${ref.definition.endLine} (${ref.definition.kind})`,
        );
      } else {
        lines.push(`${ref.name}  -> unresolved`);
      }
    }
  }

  if (includeSet.has('tests')) {
    const imports = await fileImports({ file: absFile, direction: 'incoming', root });
    const testFiles = imports.incoming.filter((file) => hasTestPath(file)).slice(0, 12);
    const tests = await Promise.all(
      testFiles.map(async (file) => {
        const abs = resolve(root, file);
        const content = await readFileText(abs);
        const usages = findUsagesInContent(selected.name, file, content).slice(0, 6);
        return { file, usages };
      }),
    );
    result.tests = tests.filter((entry) => entry.usages.length > 0);
    lines.push('', `── tests (${result.tests.length}) ───────────────────────────────`);
    if (!result.tests.length) lines.push('none');
    for (const testRef of result.tests) {
      if (testRef.usages.length === 0) continue;
      const refs = testRef.usages.map((u) => `L${u.line}`).join(', ');
      lines.push(`${testRef.file}: ${refs}`);
    }
  }

  if (includeSet.has('conventions')) {
    const inferred = await conventions({ directory: dirname(absFile) });
    result.conventions = inferred.signals;
    lines.push('', inferred.output);
  }

  result.output = lines.join('\n');
  return result;
}
