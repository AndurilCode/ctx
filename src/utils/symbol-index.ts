import type { SymbolDefinition, SymbolUsage } from '../types/symbols.js';

export function findUsagesInContent(
  symbolName: string,
  filePath: string,
  content: string,
): SymbolUsage[] {
  const lines = content.split('\n');
  const usages: SymbolUsage[] = [];
  const pattern = new RegExp(`\\b${escapeRegex(symbolName)}\\b`);

  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i] as string)) {
      usages.push({ file: filePath, line: i + 1, context: (lines[i] as string).trim() });
    }
  }

  return usages;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function flattenNodes(
  nodes: import('../types/outline.js').OutlineNode[],
  file: string,
  kind?: string,
): SymbolDefinition[] {
  const results: SymbolDefinition[] = [];

  function walk(nodeList: import('../types/outline.js').OutlineNode[]): void {
    for (const node of nodeList) {
      if (!kind || node.kind === kind) {
        results.push({ file, name: node.name, kind: node.kind, startLine: node.startLine, endLine: node.endLine });
      }
      if (node.children) walk(node.children);
    }
  }

  walk(nodes);
  return results;
}
