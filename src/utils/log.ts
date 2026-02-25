import type { LogPruneOptions, LogPruneResult } from '../types/log.js';
import { createFallbackTokenCounter } from './tokens.js';
import { applyCustomRules } from './log-custom-rules.js';
import {
  dedupeStackTraces,
  elideHealthChecks,
  foldDebugLines,
  foldFrameworkStartup,
  foldJsonLines,
  stripUserAgents,
} from './log-generic.js';
import {
  ANSI_RE,
  CARRIAGE_RE,
  OSC_RE,
  collapseBlankLines,
  foldConsecutiveRepeats,
  foldGlobalRepeats,
  foldProgressLines,
  splitLines,
  stripTimestamps,
} from './log-rules.js';
import { foldLinterDiagnostics, foldTypecheckDiagnostics, pruneTestRunnerLines } from './log-toolchain.js';

const DEFAULT_OPTIONS: Required<
  Omit<LogPruneOptions, 'customRules' | 'thresholdTokens' | 'tokenCounter'>
> = {
  stripAnsi: true,
  foldProgress: true,
  stripTimestamps: 'auto',
  elidePassingTests: true,
  foldDebugLines: true,
  elideHealthChecks: true,
  foldJsonLines: true,
  foldFrameworkStartup: true,
  stripUserAgents: true,
  dedupeStackTraces: true,
  foldRepeatedLines: true,
  foldGlobalRepeats: true,
  collapseBlanks: true,
  allowTokenExpansion: false,
};

export function pruneTerminalLog(logText: string, options: LogPruneOptions = {}): LogPruneResult {
  const config = {
    stripAnsi: options.stripAnsi ?? DEFAULT_OPTIONS.stripAnsi,
    foldProgress: options.foldProgress ?? DEFAULT_OPTIONS.foldProgress,
    stripTimestamps: options.stripTimestamps ?? DEFAULT_OPTIONS.stripTimestamps,
    elidePassingTests: options.elidePassingTests ?? DEFAULT_OPTIONS.elidePassingTests,
    foldDebugLines: options.foldDebugLines ?? DEFAULT_OPTIONS.foldDebugLines,
    elideHealthChecks: options.elideHealthChecks ?? DEFAULT_OPTIONS.elideHealthChecks,
    foldJsonLines: options.foldJsonLines ?? DEFAULT_OPTIONS.foldJsonLines,
    foldFrameworkStartup: options.foldFrameworkStartup ?? DEFAULT_OPTIONS.foldFrameworkStartup,
    stripUserAgents: options.stripUserAgents ?? DEFAULT_OPTIONS.stripUserAgents,
    dedupeStackTraces: options.dedupeStackTraces ?? DEFAULT_OPTIONS.dedupeStackTraces,
    foldRepeatedLines: options.foldRepeatedLines ?? DEFAULT_OPTIONS.foldRepeatedLines,
    foldGlobalRepeats: options.foldGlobalRepeats ?? DEFAULT_OPTIONS.foldGlobalRepeats,
    collapseBlanks: options.collapseBlanks ?? DEFAULT_OPTIONS.collapseBlanks,
    allowTokenExpansion: options.allowTokenExpansion ?? DEFAULT_OPTIONS.allowTokenExpansion,
  };

  const appliedRules: string[] = [];
  const tokenCounter = options.tokenCounter ?? createFallbackTokenCounter();
  const originalTokens = tokenCounter.count(logText);

  let text = logText;
  if (config.stripAnsi) {
    const stripped = text.replace(ANSI_RE, '').replace(OSC_RE, '').replace(CARRIAGE_RE, '');
    if (stripped !== text) appliedRules.push('ansi-strip');
    text = stripped;
  }

  let lines = splitLines(text);
  if (options.customRules && options.customRules.length > 0) {
    lines = applyCustomRules(lines, options.customRules, appliedRules);
  }

  if (config.foldProgress) lines = foldProgressLines(lines, appliedRules);
  if (config.foldDebugLines) lines = foldDebugLines(lines, appliedRules);
  if (config.elideHealthChecks) lines = elideHealthChecks(lines, appliedRules);
  if (config.foldJsonLines) lines = foldJsonLines(lines, appliedRules);
  if (config.foldFrameworkStartup) lines = foldFrameworkStartup(lines, appliedRules);
  if (config.stripUserAgents) lines = stripUserAgents(lines, appliedRules);

  if (config.elidePassingTests) lines = pruneTestRunnerLines(lines, appliedRules);
  lines = foldLinterDiagnostics(lines, appliedRules);
  lines = foldTypecheckDiagnostics(lines, appliedRules);

  lines = stripTimestamps(lines, config.stripTimestamps, appliedRules);
  if (config.dedupeStackTraces) lines = dedupeStackTraces(lines, appliedRules);
  if (config.foldRepeatedLines) lines = foldConsecutiveRepeats(lines, appliedRules);
  if (config.foldGlobalRepeats) lines = foldGlobalRepeats(lines, appliedRules);
  if (config.collapseBlanks) lines = collapseBlankLines(lines, appliedRules);

  const candidateOutput = lines.join('\n').trimEnd();
  const candidateTokens = tokenCounter.count(candidateOutput);

  const thresholdTokens =
    typeof options.thresholdTokens === 'number' && Number.isFinite(options.thresholdTokens)
      ? Math.max(0, Math.floor(options.thresholdTokens))
      : undefined;

  if (!config.allowTokenExpansion && candidateTokens > originalTokens) {
    const output = text.trimEnd();
    const prunedTokens = originalTokens;
    return {
      output,
      originalTokens,
      prunedTokens,
      savingsPercent: 0,
      appliedRules: [],
      pruned: false,
      thresholdTokens,
      overThreshold: thresholdTokens === undefined ? undefined : prunedTokens > thresholdTokens,
    };
  }

  const savingsPercent = originalTokens === 0 ? 0 : ((originalTokens - candidateTokens) / originalTokens) * 100;

  return {
    output: candidateOutput,
    originalTokens,
    prunedTokens: candidateTokens,
    savingsPercent,
    appliedRules,
    pruned: candidateTokens < originalTokens,
    thresholdTokens,
    overThreshold: thresholdTokens === undefined ? undefined : candidateTokens > thresholdTokens,
  };
}
