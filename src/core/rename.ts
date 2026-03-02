import { readFile } from 'node:fs/promises';
import { dirname, resolve, isAbsolute } from 'node:path';
import fg from 'fast-glob';
import type { RenameInput, RenameResult } from '../types/patch.js';
import { locateSymbol } from '../parser/patch-engine.js';
import { atomicWrite } from '../utils/atomic-write.js';

const DEFAULT_GLOB = '**/*.{ts,tsx,js,jsx,py,rs,go}';
const IGNORE = ['node_modules/**', 'dist/**', '.git/**'];

/**
 * Rename a symbol across files.
 *
 * 1. Read definition file, locate symbol, validate hash
 * 2. Find all files in scope using fast-glob
 * 3. For each file, regex-replace all occurrences of the old name with the new name
 * 4. If dryRun, return summary without writing
 * 5. Write all files atomically
 * 6. Return RenameSuccess
 */
export async function rename(input: RenameInput): Promise<RenameResult> {
  const { file, symbol, hash, to, scope, dryRun } = input;

  // ── Phase 1: Read definition file, locate symbol, validate hash ──
  const source = await readFile(file, 'utf8');
  const loc = await locateSymbol(source, symbol, { language: 'typescript' });

  if (!loc) {
    return {
      ok: false,
      error: {
        code: 'SYMBOL_NOT_FOUND',
        message: `Symbol "${symbol}" not found in ${file}`,
      },
    };
  }

  if (loc.hash !== hash) {
    return {
      ok: false,
      error: {
        code: 'STALE_READ',
        message: `Hash mismatch for "${symbol}": expected ${hash}, got ${loc.hash}`,
      },
    };
  }

  // ── Phase 2: Determine scope and find files ──
  let scopeRoot: string;
  let globPattern: string;

  if (scope) {
    // The scope may be an absolute glob like /tmp/dir/src/**/*.ts
    // We need to split it into a cwd (the non-glob prefix) and a pattern
    const absScope = isAbsolute(scope) ? scope : resolve(scope);
    // Find where the glob part starts (first segment with * or { or ?)
    const parts = absScope.split('/');
    const globStartIdx = parts.findIndex((p) => /[*?{]/.test(p));
    if (globStartIdx === -1) {
      // scope is a plain directory path — use default glob inside it
      scopeRoot = absScope;
      globPattern = DEFAULT_GLOB;
    } else {
      scopeRoot = parts.slice(0, globStartIdx).join('/') || '/';
      globPattern = parts.slice(globStartIdx).join('/');
    }
  } else {
    scopeRoot = dirname(resolve(file));
    globPattern = DEFAULT_GLOB;
  }

  const files = await fg(globPattern, {
    cwd: scopeRoot,
    absolute: true,
    ignore: IGNORE,
  });

  // Ensure the definition file is included
  const absFile = resolve(file);
  if (!files.includes(absFile)) {
    files.push(absFile);
  }

  // ── Phase 3: Find and replace in each file ──
  const pattern = new RegExp(`\\b${escapeRegex(symbol)}\\b`, 'g');
  const edits: Array<{ filePath: string; content: string }> = [];
  let totalReferences = 0;

  for (const filePath of files) {
    const content = await readFile(filePath, 'utf8');
    const matches = content.match(pattern);
    if (!matches) continue;

    const updated = content.replace(pattern, to);
    totalReferences += matches.length;
    edits.push({ filePath, content: updated });
  }

  // ── Phase 4: Dry-run — return summary without writing ──
  if (dryRun) {
    return {
      ok: true,
      filesChanged: edits.length,
      referencesUpdated: totalReferences,
      summary: `Would rename "${symbol}" → "${to}": ${totalReferences} references in ${edits.length} file(s)`,
    };
  }

  // ── Phase 5: Write all files atomically ──
  for (const edit of edits) {
    await atomicWrite(edit.filePath, edit.content);
  }

  return {
    ok: true,
    filesChanged: edits.length,
    referencesUpdated: totalReferences,
    summary: `Renamed "${symbol}" → "${to}": ${totalReferences} references in ${edits.length} file(s)`,
  };
}

/** Escape special regex characters in a string. */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
