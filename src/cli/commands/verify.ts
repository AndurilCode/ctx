import { defineCommand } from 'citty';
import { verifyChanges } from '../../core/change-verify.js';

export const verifyCommand = defineCommand({
  meta: {
    name: 'verify',
    description: 'Targeted change verification with plan mode (default) and optional exec mode.',
  },
  args: {
    file: {
      type: 'positional',
      required: false,
      description: 'Path to changed file to verify.',
    },
    symbol: {
      type: 'string',
      required: false,
      description: 'Limit analysis to a specific symbol.',
    },
    since: {
      type: 'string',
      required: false,
      description: 'Previous symbol hash for change comparison.',
    },
    diff: {
      type: 'boolean',
      required: false,
      default: false,
      description: 'Verify files in the working tree diff.',
    },
    exec: {
      type: 'boolean',
      required: false,
      default: false,
      description: 'Execute the verification plan.',
    },
    testCommand: {
      type: 'string',
      required: false,
      description: 'Override test command.',
    },
    typeCommand: {
      type: 'string',
      required: false,
      description: 'Override type-check command.',
    },
    timeoutMs: {
      type: 'string',
      required: false,
      default: '30000',
      description: 'Per-command timeout in milliseconds for --exec mode.',
    },
  },
  async run({ args }) {
    const result = await verifyChanges({
      file: args.file ? String(args.file) : undefined,
      symbol: args.symbol ? String(args.symbol) : undefined,
      since: args.since ? String(args.since) : undefined,
      diff: args.diff === true,
      exec: args.exec === true,
      testCommand: args.testCommand ? String(args.testCommand) : undefined,
      typeCommand: args.typeCommand ? String(args.typeCommand) : undefined,
      timeoutMs: Number(args.timeoutMs),
    });

    process.stdout.write(result.output);
    process.stdout.write('\n');
    if (result.mode === 'exec' && result.verdict.includes('failures')) {
      process.exitCode = 1;
    }
  },
});
