import { spawnSync } from 'node:child_process';
import { relative, resolve } from 'node:path';
import type {
  VerifyChangesOptions,
  VerifyChangesResult,
  VerifyCommandResult,
} from '../types/change-verify.js';
import { detectChangedSymbols, detectWorkingTreeChangedFiles } from '../utils/change-detect.js';
import { mapTestsForFiles } from '../utils/test-mapper.js';
import { detectTools } from '../utils/tool-detect.js';
import { pruneLog } from './prune-log.js';
import { symbols } from './symbols.js';

const DEFAULT_TIMEOUT_MS = 30_000;

function buildTestCommand(base: string, testTargets: string[]): string {
  if (testTargets.length === 0) return base;
  if (base.startsWith('bun test')) {
    return `${base} ${testTargets.join(' ')}`;
  }
  if (base.startsWith('npm test --')) {
    return `${base} ${testTargets.join(' ')}`;
  }
  if (base.startsWith('vitest') || base.startsWith('jest')) {
    return `${base} ${testTargets.join(' ')}`;
  }
  return base;
}

function runCommand(command: string, cwd: string, timeoutMs: number): VerifyCommandResult {
  const executed = spawnSync(command, {
    cwd,
    shell: true,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 10 * 1024 * 1024,
  });
  const combined = `${executed.stdout ?? ''}${executed.stderr ?? ''}`;
  const pruned = pruneLog(combined, {
    elidePassingTests: true,
    foldProgress: true,
    foldDebugLines: true,
    dedupeStackTraces: true,
  });
  const timedOut = executed.signal === 'SIGTERM';
  return {
    command,
    passed: executed.status === 0 && !timedOut,
    timedOut,
    exitCode: executed.status ?? 1,
    output: pruned.output,
  };
}

export async function verifyChanges(options: VerifyChangesOptions): Promise<VerifyChangesResult> {
  const root = resolve(options.root ?? '.');
  const files = new Set<string>();
  if (options.diff) {
    for (const file of detectWorkingTreeChangedFiles(root)) files.add(file);
  }
  if (options.file) {
    files.add(relative(resolve('.'), resolve(root, options.file)));
  }
  const selectedFiles = [...files];

  const changedSymbols = await detectChangedSymbols({
    files: selectedFiles,
    root,
    symbol: options.symbol,
    since: options.since,
  });

  const callers: Record<string, string[]> = {};
  for (const changed of changedSymbols) {
    const key = `${changed.file}::${changed.symbol}`;
    try {
      const usageResult = await symbols({ query: changed.symbol, path: root });
      callers[key] = usageResult.usages
        .filter((usage) => usage.file !== changed.file)
        .slice(0, 10)
        .map((usage) => `${usage.file}:${usage.line}`);
    } catch {
      callers[key] = [];
    }
  }

  const testTargets = await mapTestsForFiles(selectedFiles, root, options.symbol);
  const tools = await detectTools(root);
  const typeCommand = options.typeCommand ?? tools.typeCommand;
  const testCommandBase = options.testCommand ?? tools.testCommand;
  const testCommand =
    testCommandBase && testTargets.length > 0
      ? buildTestCommand(
          testCommandBase,
          testTargets.map((t) => t.file),
        )
      : testCommandBase;

  const plan: string[] = [];
  if (typeCommand) plan.push(`Type check: ${typeCommand}`);
  if (testCommand) plan.push(`Targeted tests: ${testCommand}`);
  if (!plan.length) plan.push('No toolchain commands detected. Run repository checks manually.');

  const mode = options.exec ? 'exec' : 'plan';
  const lines: string[] = [
    `verify: ${selectedFiles.length ? selectedFiles.join(', ') : '(no files selected)'}${mode === 'exec' ? ' [exec]' : ''}`,
    '',
    '── changes ────────────────────────────────────────',
  ];

  if (changedSymbols.length === 0) {
    lines.push('No symbol-level changes detected.');
  } else {
    for (const changed of changedSymbols) {
      lines.push(
        `${changed.file}::${changed.symbol} ${changed.hashBefore ? `${changed.hashBefore} -> ` : ''}${changed.hashAfter ?? 'unknown'}`,
      );
    }
  }

  lines.push('', '── impact ─────────────────────────────────────────');
  if (Object.keys(callers).length === 0) {
    lines.push('No incoming callers detected.');
  } else {
    for (const [symbolKey, entries] of Object.entries(callers)) {
      lines.push(`${symbolKey}`);
      if (entries.length === 0) lines.push('  callers: none');
      for (const entry of entries) lines.push(`  ${entry}`);
    }
  }

  lines.push('', '── verify plan ────────────────────────────────────');
  for (let i = 0; i < plan.length; i++) {
    lines.push(`${i + 1}. ${plan[i]}`);
  }
  if (testTargets.length > 0) {
    lines.push('', 'Targeted test files:');
    for (const target of testTargets) {
      lines.push(`- ${target.file}${target.usages.length ? ` (${target.usages.length} symbol refs)` : ''}`);
    }
  }

  if (!options.exec) {
    const verdict =
      changedSymbols.length === 0
        ? 'No relevant changes detected.'
        : `Plan generated for ${changedSymbols.length} changed symbol(s).`;
    lines.push('', '── verdict ────────────────────────────────────────', verdict);
    return {
      mode,
      files: selectedFiles,
      changedSymbols,
      callers,
      typeCommand,
      testCommand,
      testTargets: testTargets.map((target) => target.file),
      plan,
      verdict,
      output: lines.join('\n'),
    };
  }

  const timeoutMs = Math.max(1_000, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const typeCheck = typeCommand ? runCommand(typeCommand, root, timeoutMs) : undefined;
  const tests = testCommand ? runCommand(testCommand, root, timeoutMs) : undefined;

  if (typeCheck) {
    lines.push(
      '',
      `── type check: ${typeCheck.passed ? 'PASS' : typeCheck.timedOut ? 'TIMEOUT' : 'FAIL'} ───────────────────────────────`,
      typeCheck.output || '(no output)',
    );
  }
  if (tests) {
    lines.push(
      '',
      `── tests: ${tests.passed ? 'PASS' : tests.timedOut ? 'TIMEOUT' : 'FAIL'} ─────────────────────────────────`,
      tests.output || '(no output)',
    );
  }

  const passed = (typeCheck ? typeCheck.passed : true) && (tests ? tests.passed : true);
  const verdict = passed
    ? 'Targeted verification passed.'
    : 'Targeted verification found failures or timed out.';
  lines.push('', '── verdict ────────────────────────────────────────', verdict);

  return {
    mode,
    files: selectedFiles,
    changedSymbols,
    callers,
    typeCommand,
    testCommand,
    testTargets: testTargets.map((target) => target.file),
    plan,
    typeCheck,
    tests,
    verdict,
    output: lines.join('\n'),
  };
}
