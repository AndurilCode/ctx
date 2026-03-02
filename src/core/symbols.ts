import { relative, resolve } from 'node:path';
import fg from 'fast-glob';

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
import type {
  SymbolDefinition,
  SymbolsOptions,
  SymbolsResult,
  SymbolUsage,
} from '../types/symbols.js';
import { readFileText } from '../utils/file-reader.js';
import { findUsagesInContent, flattenNodes } from '../utils/symbol-index.js';

export async function symbols(options: SymbolsOptions): Promise<SymbolsResult> {
  const root = resolve(options.path ?? '.');
  const globPattern = options.glob ?? '**/*.{ts,tsx,js,jsx,py,rs,go}';
  const escapedQuery = escapeRegex(options.query);
  const usagePattern = new RegExp(`\\b${escapedQuery}\\b`);
  const namePattern = new RegExp(
    `(?:^|(?<=[^a-zA-Z0-9_]))${escapedQuery}(?=$|[^a-zA-Z0-9_])`,
    'i',
  );

  const files = await fg(globPattern, {
    cwd: root,
    ignore: ['node_modules/**', 'dist/**', '.git/**'],
  });

  const allDefinitions: SymbolDefinition[] = [];
  const allUsages: SymbolUsage[] = [];
  const { codeOutline } = await import('./code-outline.js');

  await Promise.all(
    files.map(async (relFile) => {
      const absFile = resolve(root, relFile);
      const workspaceRel = relative(resolve('.'), absFile);
      let content: string;
      try {
        content = await readFileText(absFile);
      } catch {
        return;
      }

      // Fast prefilter: skip costly parsing/scan if the query cannot appear in this file.
      if (!usagePattern.test(content) && !namePattern.test(content)) {
        return;
      }

      // Find definitions via code-outline
      try {
        const outlined = await codeOutline(content, { filePath: absFile });
        const defs = flattenNodes(outlined.nodes, workspaceRel, options.kind);
        const matching = defs.filter((d) => namePattern.test(d.name));
        allDefinitions.push(...matching);
      } catch {
        // language not supported by tree-sitter — skip outline
      }

      // Find usages via regex
      const usages = findUsagesInContent(options.query, workspaceRel, content);
      allUsages.push(...usages);
    }),
  );

  // Deduplicate usages (definition files will appear as usages too — that's fine)
  const seenUsageLocations = new Set<string>();
  const uniqueUsages = allUsages.filter((usage) => {
    const key = `${usage.file}:${usage.line}`;
    if (seenUsageLocations.has(key)) return false;
    seenUsageLocations.add(key);
    return true;
  });

  const output = formatOutput(options.query, allDefinitions, uniqueUsages);
  return { query: options.query, definitions: allDefinitions, usages: uniqueUsages, output };
}

function formatOutput(query: string, defs: SymbolDefinition[], usages: SymbolUsage[]): string {
  const lines: string[] = [query, ''];

  if (defs.length > 0) {
    lines.push('Defined in:');
    for (const def of defs) {
      lines.push(`  ${def.file}:${def.startLine}-${def.endLine}  (${def.kind})`);
    }
    lines.push('');
  } else {
    lines.push('Defined in: not found');
    lines.push('');
  }

  if (usages.length > 0) {
    lines.push('Used in:');
    for (const usage of usages.slice(0, 20)) {
      // cap at 20 usages
      lines.push(`  ${usage.file}:${usage.line}  ${usage.context.slice(0, 80)}`);
    }
    if (usages.length > 20) {
      lines.push(`  ... and ${usages.length - 20} more`);
    }
  } else {
    lines.push('Used in: none found');
  }

  return lines.join('\n');
}
