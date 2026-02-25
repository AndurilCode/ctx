const PASS_RE = /^(?:\(pass\)|\s*(?:✓|✔|PASS\b|--- PASS:|test .* \.\.\. ok\b|PASSED\b))/;
const FAIL_RE = /^(?:\(fail\)|\s*(?:✗|✘|FAIL\b|FAILED\b|--- FAIL:|test .* \.\.\. FAILED\b|not ok\b))/;
const SUMMARY_RE = /^(Test Suites:|Tests:|Ran \d+ tests|\d+ passing|\d+ failing|\d+ passed|\d+ failed)/i;
const BIOME_FILE_RE = /^\.\/.*\s(?:format|lint|organizeImports)\s/;
const TSC_ERROR_RE = /^(.+)\((\d+),(\d+)\):\s+error\s+TS\d+:/;
const MYPY_ERROR_RE = /^(.+):(\d+):\s+error:/;

export function pruneTestRunnerLines(lines: string[], appliedRules: string[]): string[] {
  const passCount = lines.filter((line) => PASS_RE.test(line)).length;
  const failCount = lines.filter((line) => FAIL_RE.test(line)).length;
  const summaryCount = lines.filter((line) => SUMMARY_RE.test(line)).length;
  if (passCount < 5 && failCount === 0) return lines;

  const next: string[] = [];
  for (const line of lines) {
    if (PASS_RE.test(line)) continue;
    if (failCount === 0 && !SUMMARY_RE.test(line) && line.startsWith('tests/')) continue;
    next.push(line);
  }

  next.unshift(`[tests pruned: ${passCount} passing stripped, ${failCount} failing kept]`);
  if (summaryCount === 0 && failCount === 0) {
    next.push('[all tests passed]');
  }
  appliedRules.push('test-runner-elision');
  return next;
}

export function foldLinterDiagnostics(lines: string[], appliedRules: string[]): string[] {
  const hasBiome = lines.some((line) => BIOME_FILE_RE.test(line));
  if (!hasBiome) return lines;

  const next: string[] = [];
  let cursor = 0;
  let folded = 0;

  while (cursor < lines.length) {
    const line = lines[cursor] ?? '';
    if (!BIOME_FILE_RE.test(line)) {
      next.push(line);
      cursor++;
      continue;
    }

    folded++;
    next.push(`[diagnostic block ${folded}] ${line}`);
    cursor++;

    let keptMessage = false;
    while (cursor < lines.length) {
      const current = lines[cursor] ?? '';
      if (current === '') break;
      if (BIOME_FILE_RE.test(current)) break;
      if (!keptMessage && current.includes('×')) {
        next.push(current);
        keptMessage = true;
      }
      cursor++;
    }
  }

  if (folded > 0) {
    appliedRules.push('linter-fold');
  }
  return next;
}

export function foldTypecheckDiagnostics(lines: string[], appliedRules: string[]): string[] {
  const grouped = new Map<string, string[]>();

  for (const line of lines) {
    const tsc = line.match(TSC_ERROR_RE);
    if (tsc?.[1]) {
      grouped.set(tsc[1], [...(grouped.get(tsc[1]) ?? []), line]);
      continue;
    }

    const mypy = line.match(MYPY_ERROR_RE);
    if (mypy?.[1]) {
      grouped.set(mypy[1], [...(grouped.get(mypy[1]) ?? []), line]);
    }
  }

  if (grouped.size === 0) return lines;

  const kept = lines.filter((line) => !line.match(TSC_ERROR_RE) && !line.match(MYPY_ERROR_RE));

  for (const [file, errors] of grouped.entries()) {
    const limit = Math.min(3, errors.length);
    kept.push(`[typecheck] ${file}: ${errors.length} errors`);
    for (let i = 0; i < limit; i++) kept.push(errors[i] ?? '');
    if (errors.length > limit) kept.push(`[typecheck] ${errors.length - limit} more errors folded`);
  }

  appliedRules.push('typecheck-fold');
  return kept;
}
