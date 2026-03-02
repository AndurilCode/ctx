import { readFile } from 'node:fs/promises';
import {
  applyLineEdits,
  locateSymbol,
  locateSymbolByHash,
  replaceSymbolBody,
} from '../parser/patch-engine.js';
import type { SymbolLocation } from '../types/patch-engine.js';
import type { PatchInput, PatchResult, SinglePatchOp } from '../types/patch.js';
import { atomicWrite } from '../utils/atomic-write.js';
import { codeOutline } from './code-outline.js';
import { computeDiffSummary, injectImports } from './patch-helpers.js';

/** Get a fresh outline string for error reporting. */
async function freshOutline(source: string, language?: string): Promise<string> {
  const result = await codeOutline(source, { language });
  return result.output;
}

/** Normalize input into an array of SinglePatchOp. */
function normalizeOps(input: PatchInput): SinglePatchOp[] | null {
  if (input.patches) return input.patches;
  if (input.symbol) {
    return [
      {
        symbol: input.symbol,
        hash: input.hash ?? '',
        body: input.body,
        lines: input.lines,
        imports: input.imports,
      },
    ];
  }
  return null; // hashline fallback — no symbol
}

/** Core patch orchestrator with atomicity, import injection, dry-run. */
export async function patch(input: PatchInput): Promise<PatchResult> {
  const source = await readFile(input.file, 'utf8');
  const ops = normalizeOps(input);
  const lang = input.language ?? 'ts';

  // ── Hashline fallback: line edits on entire file ──
  if (ops === null && input.lines) {
    const newSource = applyLineEdits(source, input.lines);
    const { diff, linesChanged } = computeDiffSummary(source, newSource);
    if (!input.dryRun) await atomicWrite(input.file, newSource);
    return { ok: true, diff, linesChanged };
  }

  if (!ops || ops.length === 0) {
    return { ok: true, diff: '', linesChanged: 0 };
  }

  // ── Phase 1: Validate all hashes ──
  const located: Array<{
    op: SinglePatchOp;
    location: SymbolLocation;
  }> = [];

  for (const op of ops) {
    const loc = await locateSymbol(source, op.symbol, { language: lang });
    if (!loc) {
      return {
        ok: false,
        error: {
          code: 'SYMBOL_NOT_FOUND',
          message: `Symbol "${op.symbol}" not found`,
          freshOutline: await freshOutline(source, lang),
        },
      };
    }

    if (loc.hash !== op.hash) {
      // Try disambiguation by hash
      const byHash = await locateSymbolByHash(source, op.symbol, op.hash, { language: lang });
      if (byHash) {
        located.push({ op, location: byHash });
        continue;
      }
      if (loc.ambiguous) {
        return {
          ok: false,
          error: {
            code: 'AMBIGUOUS_SYMBOL',
            message: `Symbol "${op.symbol}" is ambiguous and hash doesn't match`,
            freshOutline: await freshOutline(source, lang),
            disambiguation: loc.ambiguous,
          },
        };
      }
      return {
        ok: false,
        error: {
          code: 'STALE_READ',
          message: `Hash mismatch for "${op.symbol}"`,
          freshOutline: await freshOutline(source, lang),
        },
      };
    }

    located.push({ op, location: loc });
  }

  // ── Phase 2: Apply replacements (descending offset order) ──
  let newSource = source;
  const sorted = [...located].sort((a, b) => b.location.startIndex - a.location.startIndex);

  for (const { op, location } of sorted) {
    if (op.body !== undefined) {
      newSource = replaceSymbolBody(newSource, location, op.body);
    } else if (op.lines) {
      const symbolText = newSource.slice(location.startIndex, location.endIndex);
      const edited = applyLineEdits(symbolText, op.lines);
      newSource = replaceSymbolBody(newSource, location, edited);
    }
  }

  // ── Phase 3: Import injection ──
  const allImports = ops.flatMap((op) => op.imports ?? []);
  if (input.imports) allImports.push(...input.imports);
  if (allImports.length > 0) {
    newSource = injectImports(newSource, allImports);
  }

  // ── Phase 4: Diff summary ──
  const { diff, linesChanged } = computeDiffSummary(source, newSource);

  // ── Dry-run: return without writing ──
  if (input.dryRun) {
    return { ok: true, diff, linesChanged };
  }

  // ── Phase 5: Atomic write + updated outline ──
  await atomicWrite(input.file, newSource);
  const outline = await codeOutline(newSource, { language: lang });
  return {
    ok: true,
    diff,
    linesChanged,
    updatedOutline: outline.output,
  };
}
