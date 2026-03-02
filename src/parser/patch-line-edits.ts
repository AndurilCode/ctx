import type { PatchLineEdit } from '../types/patch.js';
import type { LineHash } from '../types/patch-engine.js';
import { shortHash } from '../utils/hash.js';

/**
 * Compute a 2-char hash for each line in the given body text.
 */
export function computeLineHashes(body: string): LineHash[] {
  const lines = body.split('\n');
  // If body ends with \n, the last element of split is empty — don't hash it
  const effectiveLines =
    body.endsWith('\n') && lines[lines.length - 1] === '' ? lines.slice(0, -1) : lines;

  return effectiveLines.map((line, i) => ({
    hash: shortHash(line, 2),
    line,
    lineNumber: i + 1,
  }));
}

/**
 * Apply line-level edits to a body. Each edit targets a line by its 2-char hash.
 *
 * Supported operations:
 * - `replace`: replace the matched line's content
 * - `after`: insert a new line after the matched line
 * - `before`: insert a new line before the matched line
 * - `delete`: remove the matched line
 *
 * Throws if no line matches the given hash.
 */
export function applyLineEdits(body: string, edits: PatchLineEdit[]): string {
  const lines = body.split('\n');
  const trailingNewline = body.endsWith('\n') && lines[lines.length - 1] === '';
  const effectiveLines = trailingNewline ? lines.slice(0, -1) : [...lines];
  const lineHashes = effectiveLines.map((line) => shortHash(line, 2));

  for (const edit of edits) {
    const idx = lineHashes.findIndex((h) => h === edit.hash);
    if (idx === -1) {
      throw new Error(
        `Hash mismatch: no line matches hash "${edit.hash}". ` +
          `Available hashes: [${lineHashes.join(', ')}]`,
      );
    }

    if (edit.delete) {
      effectiveLines.splice(idx, 1);
      lineHashes.splice(idx, 1);
    } else if (edit.replace !== undefined) {
      effectiveLines[idx] = edit.replace;
      lineHashes[idx] = shortHash(edit.replace, 2);
    }

    if (edit.after !== undefined) {
      const insertIdx = edit.delete ? idx : idx + 1;
      effectiveLines.splice(insertIdx, 0, edit.after);
      lineHashes.splice(insertIdx, 0, shortHash(edit.after, 2));
    }

    if (edit.before !== undefined) {
      effectiveLines.splice(idx, 0, edit.before);
      lineHashes.splice(idx, 0, shortHash(edit.before, 2));
    }
  }

  return trailingNewline ? effectiveLines.join('\n') + '\n' : effectiveLines.join('\n');
}
