import type { OutlineNode, OutlineOptions } from '../types/outline.js';
import type { SymbolLocation } from '../types/patch-engine.js';
import { shortHash } from '../utils/hash.js';
import { parseOutline } from './code-outline.js';

// Re-export types and line-edit functions for convenience
export type { SymbolLocation, LineHash } from '../types/patch-engine.js';
export { computeLineHashes, applyLineEdits } from './patch-line-edits.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Convert a 1-based line number to the byte offset of the start of that line. */
function lineToIndex(source: string, line: number): number {
  const lines = source.split('\n');
  let index = 0;
  for (let i = 0; i < line - 1 && i < lines.length; i++) {
    index += (lines[i]?.length ?? 0) + 1; // +1 for \n
  }
  return index;
}

/** Byte offset just past the end of the given 1-based line (exclusive of trailing \n). */
function lineEndToIndex(source: string, line: number): number {
  const lines = source.split('\n');
  let index = 0;
  for (let i = 0; i < line && i < lines.length; i++) {
    index += (lines[i]?.length ?? 0) + 1;
  }
  return Math.min(index - 1, source.length);
}

/** Recursively collect all OutlineNode matches by name from the node tree. */
function collectMatches(nodes: OutlineNode[], name: string): OutlineNode[] {
  const matches: OutlineNode[] = [];
  for (const node of nodes) {
    if (node.name === name) matches.push(node);
    if (node.children) matches.push(...collectMatches(node.children, name));
  }
  return matches;
}

/** Build a SymbolLocation from an OutlineNode. */
function nodeToLocation(source: string, node: OutlineNode): SymbolLocation {
  // Use line-based ranges for replacement (includes export prefix, indentation, etc.)
  // The hash is an AST-level freshness check — it doesn't need to describe the exact range.
  return {
    name: node.name,
    hash:
      node.hash ??
      shortHash(
        source.slice(lineToIndex(source, node.startLine), lineEndToIndex(source, node.endLine)),
      ),
    startLine: node.startLine,
    endLine: node.endLine,
    startIndex: lineToIndex(source, node.startLine),
    endIndex: lineEndToIndex(source, node.endLine),
  };
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Locate a symbol by name using tree-sitter parsing.
 * Returns the first match; if ambiguous, `ambiguous` lists all candidates.
 */
export async function locateSymbol(
  source: string,
  symbolName: string,
  options: OutlineOptions = {},
): Promise<SymbolLocation | undefined> {
  const { nodes } = await parseOutline(source, options);
  const matches = collectMatches(nodes, symbolName);
  if (matches.length === 0) return undefined;

  const first = matches[0];
  if (!first) return undefined;
  const location = nodeToLocation(source, first);

  if (matches.length > 1) {
    location.ambiguous = matches.map((m) => ({
      name: m.name,
      hash:
        m.hash ??
        shortHash(
          source.slice(lineToIndex(source, m.startLine), lineEndToIndex(source, m.endLine)),
        ),
      startLine: m.startLine,
      endLine: m.endLine,
    }));
  }

  return location;
}

/**
 * Locate a symbol by name AND hash, disambiguating when multiple symbols
 * share the same name. Returns undefined if no candidate matches the hash.
 */
export async function locateSymbolByHash(
  source: string,
  symbolName: string,
  expectedHash: string,
  options: OutlineOptions = {},
): Promise<SymbolLocation | undefined> {
  const { nodes } = await parseOutline(source, options);
  const matches = collectMatches(nodes, symbolName);

  for (const m of matches) {
    const loc = nodeToLocation(source, m);
    if (loc.hash === expectedHash) return loc;
  }
  return undefined;
}

/** Replace the body of a symbol at the given location, returning the new source. */
export function replaceSymbolBody(
  source: string,
  location: SymbolLocation,
  newBody: string,
): string {
  return source.slice(0, location.startIndex) + newBody + source.slice(location.endIndex);
}
