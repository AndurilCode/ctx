import { readFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import type { ImportEdge } from '../types/imports.js';

const IMPORT_PATTERN =
  /(?:import|export)\s+(?:type\s+)?(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g;
const REQUIRE_PATTERN = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const DYNAMIC_IMPORT_PATTERN = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

const TS_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

export function extractImportSpecifiers(content: string): string[] {
  const specifiers: string[] = [];
  const patterns = [IMPORT_PATTERN, REQUIRE_PATTERN, DYNAMIC_IMPORT_PATTERN];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(content)) !== null) {
      if (m[1]) specifiers.push(m[1]);
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
      await readFile(candidate);
      return relative(root, candidate);
    } catch {
      // try next
    }
  }
  return null;
}

export async function extractOutgoingEdges(filePath: string, root: string): Promise<ImportEdge[]> {
  const absPath = resolve(root, filePath);
  let content: string;
  try {
    content = await readFile(absPath, 'utf8');
  } catch {
    return [];
  }

  const specifiers = extractImportSpecifiers(content);
  const edges: ImportEdge[] = [];

  for (const spec of specifiers) {
    const resolved = await resolveSpecifier(spec, absPath, root);
    if (resolved) edges.push({ specifier: spec, resolved });
  }

  return edges;
}
