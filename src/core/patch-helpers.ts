/**
 * Helpers for the patch orchestrator: import injection and diff summary.
 */

/** Inject new import statements after the last existing import, deduplicated. */
export function injectImports(source: string, imports: string[]): string {
  const lines = source.split('\n');
  let lastImportIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (line.startsWith('import ') || line.startsWith('import{')) {
      lastImportIndex = i;
    }
  }
  const existingImports = new Set(
    lines.filter((l) => l.trim().startsWith('import ')).map((l) => l.trim()),
  );
  const newImports = imports
    .map((imp) => (imp.startsWith('import ') ? imp : `import ${imp}`))
    .filter((imp) => !existingImports.has(imp.trim()));
  if (newImports.length === 0) return source;
  lines.splice(lastImportIndex + 1, 0, ...newImports);
  return lines.join('\n');
}

/** Simple line-by-line diff summary between old and new source. */
export function computeDiffSummary(
  oldSource: string,
  newSource: string,
): { diff: string; linesChanged: number } {
  const oldLines = oldSource.split('\n');
  const newLines = newSource.split('\n');
  const diffParts: string[] = [];
  let linesChanged = 0;

  const maxLen = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];
    if (oldLine !== newLine) {
      linesChanged++;
      if (oldLine !== undefined) diffParts.push(`-${oldLine}`);
      if (newLine !== undefined) diffParts.push(`+${newLine}`);
    }
  }

  return { diff: diffParts.join('\n'), linesChanged };
}
