import { readFile } from 'node:fs/promises';
import { locateSymbol } from '../parser/patch-engine.js';
import type { InsertInput, PatchResult } from '../types/patch.js';
import { atomicWrite } from '../utils/atomic-write.js';
import { codeOutline } from './code-outline.js';
import { computeDiffSummary, injectImports } from './patch-helpers.js';

/** Get a fresh outline string for error reporting. */
async function freshOutline(source: string, filePath?: string): Promise<string> {
  const result = await codeOutline(source, { filePath });
  return result.output;
}

/**
 * Find the byte offset just after the last import line.
 * Returns 0 if no imports are found.
 */
function findAfterImportsIndex(source: string): number {
  const lines = source.split('\n');
  let lastImportLine = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]?.trim() ?? '';
    if (trimmed.startsWith('import ') || trimmed.startsWith('import{')) {
      lastImportLine = i;
    }
  }
  if (lastImportLine === -1) return 0;

  // Return byte offset just after the last import line (including its \n)
  let offset = 0;
  for (let i = 0; i <= lastImportLine; i++) {
    offset += (lines[i]?.length ?? 0) + 1; // +1 for \n
  }
  return offset;
}

/**
 * Resolve the insert position to a byte index in the source string.
 * Returns the index or a PatchResult error on failure.
 */
async function resolvePosition(
  source: string,
  position: string,
  anchorHash?: string,
  filePath?: string,
): Promise<number | PatchResult> {
  if (position === 'end-of-file') {
    return source.length;
  }

  if (position === 'start-of-file') {
    return 0;
  }

  if (position === 'after-imports') {
    return findAfterImportsIndex(source);
  }

  if (position.startsWith('after:')) {
    const symbolName = position.slice('after:'.length);
    const loc = await locateSymbol(source, symbolName, { filePath });
    if (!loc) {
      return {
        ok: false,
        error: {
          code: 'SYMBOL_NOT_FOUND',
          message: `Symbol "${symbolName}" not found`,
          freshOutline: await freshOutline(source, filePath),
        },
      };
    }
    if (anchorHash && loc.hash !== anchorHash) {
      return {
        ok: false,
        error: {
          code: 'STALE_READ',
          message: `Hash mismatch for "${symbolName}": expected ${anchorHash}, got ${loc.hash}`,
          freshOutline: await freshOutline(source, filePath),
        },
      };
    }
    return loc.endIndex;
  }

  if (position.startsWith('before:')) {
    const symbolName = position.slice('before:'.length);
    const loc = await locateSymbol(source, symbolName, { filePath });
    if (!loc) {
      return {
        ok: false,
        error: {
          code: 'SYMBOL_NOT_FOUND',
          message: `Symbol "${symbolName}" not found`,
          freshOutline: await freshOutline(source, filePath),
        },
      };
    }
    if (anchorHash && loc.hash !== anchorHash) {
      return {
        ok: false,
        error: {
          code: 'STALE_READ',
          message: `Hash mismatch for "${symbolName}": expected ${anchorHash}, got ${loc.hash}`,
          freshOutline: await freshOutline(source, filePath),
        },
      };
    }
    return loc.startIndex;
  }

  return {
    ok: false,
    error: {
      code: 'PARSE_ERROR',
      message: `Unknown position: "${position}"`,
    },
  };
}

/**
 * Insert new code at a resolved position in a file.
 *
 * Supports positions: 'end-of-file', 'start-of-file', 'after-imports',
 * 'after:<symbol>', 'before:<symbol>'.
 */
export async function insert(input: InsertInput): Promise<PatchResult> {
  const source = await readFile(input.file, 'utf8');

  // ── Resolve position ──
  const resolved = await resolvePosition(source, input.position, input.anchor_hash, input.file);
  if (typeof resolved !== 'number') {
    return resolved; // It's a PatchResult error
  }
  const insertIndex = resolved;

  // ── Splice body into source ──
  let newSource: string;
  if (insertIndex === 0) {
    // start-of-file: body then existing content
    newSource = `${input.body}\n${source}`;
  } else if (insertIndex >= source.length) {
    // end-of-file: existing content then body
    newSource = `${source}\n${input.body}\n`;
  } else {
    newSource = `${source.slice(0, insertIndex)}\n${input.body}\n${source.slice(insertIndex)}`;
  }

  // ── Import injection ──
  if (input.imports && input.imports.length > 0) {
    newSource = injectImports(newSource, input.imports);
  }

  // ── Diff summary ──
  const { diff, linesChanged } = computeDiffSummary(source, newSource);

  // ── Dry-run: return without writing ──
  if (input.dryRun) {
    return { ok: true, diff, linesChanged };
  }

  // ── Atomic write + updated outline ──
  await atomicWrite(input.file, newSource);
  const outline = await codeOutline(newSource, { filePath: input.file });
  return {
    ok: true,
    diff,
    linesChanged,
    updatedOutline: outline.output,
  };
}
