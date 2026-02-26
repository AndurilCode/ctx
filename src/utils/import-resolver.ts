import { readFile, stat } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import type { ImportEdge } from '../types/imports.js';
import { mapLimit } from './async.js';

const IMPORT_PATTERN =
  /(?:import|export)\s+(?:type\s+)?(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g;
const REQUIRE_PATTERN = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const DYNAMIC_IMPORT_PATTERN = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

const TS_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const RESOLVE_CONCURRENCY = 16;

interface EdgeCacheEntry {
  mtimeNs: bigint;
  size: bigint;
  edges: ImportEdge[];
}

const outgoingEdgeCache = new Map<string, EdgeCacheEntry>();

export function extractImportSpecifiers(content: string): string[] {
  const specifiers: string[] = [];
  const patterns = [IMPORT_PATTERN, REQUIRE_PATTERN, DYNAMIC_IMPORT_PATTERN];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let m = pattern.exec(content);
    while (m !== null) {
      if (m[1]) specifiers.push(m[1]);
      m = pattern.exec(content);
    }
  }
  return [...new Set(specifiers)];
}

export async function resolveSpecifier(
  specifier: string,
  fromFile: string,
  root: string,
): Promise<string | null> {
  if (!specifier.startsWith('.')) return null; // skip npm packages

  const dir = dirname(fromFile);
  // strip .js extension to try .ts first (TS projects use .js in imports)
  const base = specifier.replace(/\.js$/, '');
  const candidates = [
    ...TS_EXTENSIONS.map((ext) => resolve(dir, `${base}${ext}`)),
    resolve(dir, specifier),
  ];

  for (const candidate of candidates) {
    try {
      await stat(candidate);
      return relative(root, candidate);
    } catch {
      // try next
    }
  }
  return null;
}

export async function extractOutgoingEdges(filePath: string, root: string): Promise<ImportEdge[]> {
  const absPath = resolve(root, filePath);

  try {
    const fileStat = await stat(absPath, { bigint: true });
    const cached = outgoingEdgeCache.get(absPath);
    if (cached && cached.mtimeNs === fileStat.mtimeNs && cached.size === fileStat.size) {
      return cached.edges;
    }

    const content = await readFile(absPath, 'utf8');
    const specifiers = extractImportSpecifiers(content);
    const resolved = await mapLimit(specifiers, RESOLVE_CONCURRENCY, async (spec) => {
      const target = await resolveSpecifier(spec, absPath, root);
      return target ? { specifier: spec, resolved: target } : null;
    });
    const edges = resolved.filter((edge): edge is ImportEdge => edge !== null);

    outgoingEdgeCache.set(absPath, {
      mtimeNs: fileStat.mtimeNs,
      size: fileStat.size,
      edges,
    });
    return edges;
  } catch {
    return [];
  }
}
