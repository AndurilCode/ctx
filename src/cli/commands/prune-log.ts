import { defineCommand } from 'citty';
import { pruneLog } from '../../core/prune-log.js';
import { parseCliCustomRules, parseTimestampMode } from '../../utils/log-options.js';
import { parseLogProfile, resolveProfiledOptions } from '../../utils/log-profiles.js';
import { createTokenCounter } from '../../utils/tokens.js';
import { readInput, writeOutput } from '../io.js';

export const pruneLogCommand = defineCommand({
  meta: {
    name: 'prune-log',
    description: 'Lossy log pruning for terminal/test/build/CI output.',
  },
  args: {
    input: {
      type: 'positional',
      required: false,
      description: 'Input log path. Omit to read from stdin.',
    },
    output: {
      type: 'string',
      alias: 'o',
      required: false,
      description: 'Output file path. Omit to write to stdout.',
    },
    timestamps: {
      type: 'string',
      required: false,
      description: 'Timestamp handling: auto | strip | keep.',
    },
    profile: {
      type: 'string',
      required: false,
      description: 'Preset profile: test | ci | lint | runtime.',
    },
    noProgress: {
      type: 'boolean',
      required: false,
      description: 'Disable progress-line folding.',
    },
    noPassElision: {
      type: 'boolean',
      required: false,
      description: 'Disable passing test-line elision.',
    },
    noRepeatFold: {
      type: 'boolean',
      required: false,
      description: 'Disable repetitive-line folding.',
    },
    noDebugFold: {
      type: 'boolean',
      required: false,
      description: 'Disable debug-line folding.',
    },
    noHealthElision: {
      type: 'boolean',
      required: false,
      description: 'Disable health-check elision.',
    },
    noJsonFold: {
      type: 'boolean',
      required: false,
      description: 'Disable JSON-line folding.',
    },
    noStartupFold: {
      type: 'boolean',
      required: false,
      description: 'Disable startup-line folding.',
    },
    noStackDedup: {
      type: 'boolean',
      required: false,
      description: 'Disable stack trace deduplication.',
    },
    thresholdTokens: {
      type: 'string',
      required: false,
      description: 'Token gate threshold for reporting over-threshold output.',
    },
    allowTokenExpansion: {
      type: 'boolean',
      required: false,
      description: 'Allow pruning output to be longer in tokens than the original.',
    },
    strip: {
      type: 'string',
      required: false,
      description: 'Regex pattern to strip. Repeat or pass comma-separated values.',
    },
    fold: {
      type: 'string',
      required: false,
      description: 'Regex pattern to fold. Repeat or pass comma-separated values.',
    },
    blockFold: {
      type: 'string',
      required: false,
      description: 'Block fold as start::end. Repeat or pass comma-separated values.',
    },
    stats: {
      type: 'boolean',
      default: false,
      description: 'Print pruning stats to stderr as JSON.',
    },
  },
  async run({ args }) {
    const logText = await readInput(args.input ? String(args.input) : undefined);
    const tokenCounter = await createTokenCounter();
    const profile = parseLogProfile(args.profile);
    const userRules = parseCliCustomRules(args.strip, args.fold, args.blockFold);

    const options = resolveProfiledOptions(profile, {
      stripTimestamps:
        args.timestamps === undefined ? undefined : parseTimestampMode(args.timestamps),
      foldProgress: args.noProgress ? false : undefined,
      elidePassingTests: args.noPassElision ? false : undefined,
      foldRepeatedLines: args.noRepeatFold ? false : undefined,
      foldDebugLines: args.noDebugFold ? false : undefined,
      elideHealthChecks: args.noHealthElision ? false : undefined,
      foldJsonLines: args.noJsonFold ? false : undefined,
      foldFrameworkStartup: args.noStartupFold ? false : undefined,
      dedupeStackTraces: args.noStackDedup ? false : undefined,
      allowTokenExpansion: args.allowTokenExpansion,
      thresholdTokens:
        args.thresholdTokens === undefined ? undefined : Number(args.thresholdTokens),
      tokenCounter,
      customRules: userRules,
    });
    const result = pruneLog(logText, options);

    await writeOutput(result.output, args.output ? String(args.output) : undefined);

    if (args.stats) {
      process.stderr.write(`${JSON.stringify(result, null, 2)}\n`);
    }
  },
});
