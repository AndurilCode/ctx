import type { OutlineNode } from '../types/outline.js';

function sectionTitle(kind: OutlineNode['kind']): string {
  if (kind === 'class') return 'Classes';
  if (kind === 'interface') return 'Interfaces';
  if (kind === 'type') return 'Types';
  if (kind === 'enum') return 'Enums';
  if (kind === 'function') return 'Functions';
  if (kind === 'method') return 'Methods';
  if (kind === 'variable') return 'Variables';
  return '';
}

function formatRange(node: OutlineNode): string {
  const span = Math.max(1, node.endLine - node.startLine + 1);
  if (node.startLine === node.endLine) return `L${node.startLine}`;
  return `L${node.startLine}-L${node.endLine}  (${span} lines)`;
}

function formatSignature(node: OutlineNode): string {
  if (!node.signature) return node.name;
  if (node.signature.includes(node.name)) return node.signature;
  return `${node.name} ${node.signature}`;
}

function formatNode(node: OutlineNode, indent: string): string[] {
  const lines = [`${indent}${formatSignature(node)}  ${formatRange(node)}`];
  for (const child of node.children ?? []) {
    lines.push(...formatNode(child, `${indent}  `));
  }
  return lines;
}

function groupByKind(nodes: OutlineNode[]): Map<OutlineNode['kind'], OutlineNode[]> {
  const grouped = new Map<OutlineNode['kind'], OutlineNode[]>();
  for (const node of nodes) {
    const items = grouped.get(node.kind) ?? [];
    items.push(node);
    grouped.set(node.kind, items);
  }
  return grouped;
}

function sortByLine(nodes: OutlineNode[]): OutlineNode[] {
  return [...nodes].sort((a, b) => a.startLine - b.startLine);
}

export function formatOutlineOutput(params: {
  pathLabel: string;
  language: string;
  totalLines: number;
  nodes: OutlineNode[];
  depth?: number;
  collapseImports?: boolean;
}): string {
  const depth = params.depth ?? Number.POSITIVE_INFINITY;
  const collapseImports = params.collapseImports ?? true;
  const topLevel = params.nodes.filter((n) => n.startLine >= 1);
  const imports = topLevel.filter((n) => n.kind === 'import');
  const nonImports = topLevel.filter((n) => n.kind !== 'import');
  const grouped = groupByKind(nonImports);
  const lines = [`${params.pathLabel}  (${params.totalLines} lines, ${params.language})`, ''];

  if (imports.length > 0) {
    if (collapseImports) {
      const names = sortByLine(imports).map((item) => item.name);
      lines.push(`Imports: ${names.join(', ')} (${imports.length} imports)`, '');
    } else {
      lines.push('Imports:');
      for (const item of sortByLine(imports)) {
        lines.push(`  ${item.name}  ${formatRange(item)}`);
      }
      lines.push('');
    }
  }

  for (const kind of [
    'class',
    'interface',
    'type',
    'enum',
    'function',
    'method',
    'variable',
  ] as const) {
    const nodes = sortByLine(grouped.get(kind) ?? []);
    if (nodes.length === 0) continue;
    lines.push(`${sectionTitle(kind)}:`);
    for (const node of nodes) {
      lines.push(...formatNode(trimDepth(node, depth), '  '));
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

function trimDepth(node: OutlineNode, depth: number, current = 1): OutlineNode {
  if (!node.children || depth <= current) {
    return { ...node, children: undefined };
  }
  return {
    ...node,
    children: node.children.map((child) => trimDepth(child, depth, current + 1)),
  };
}
