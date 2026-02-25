import { defineCommand } from 'citty';
import { compactDiff } from '../../core/compact-diff.js';
import { readInput, writeOutput } from '../io.js';

export const diffCommand = defineCommand({
  meta: {
    name: 'diff',
    description: 'Compress unified git diff output for agent-friendly consumption.',
  },
  args: {
    input: {
      type: 'positional',
      required: false,
      description: 'Input diff path. Omit to read from stdin.',
    },
    output: {
      type: 'string',
      alias: 'o',
      required: false,
      description: 'Output file path. Omit to write to stdout.',
    },
    context: {
      type: 'string',
      required: false,
      description: 'Context lines per changed block (default: 1).',
    },
    compactHeaders: {
      type: 'boolean',
      default: true,
      description: 'Compact file headers to a single line.',
    },
    noCompactHeaders: {
      type: 'boolean',
      default: false,
      description: 'Keep original diff headers unchanged.',
    },
    changesOnly: {
      type: 'boolean',
      default: false,
      description: 'Emit only file paths and changed lines.',
    },
  },
  async run({ args }) {
    const diff = await readInput(args.input ? String(args.input) : undefined);
    const output = compactDiff(diff, {
      context: args.context === undefined ? undefined : Number(args.context),
      compactHeaders: args.compactHeaders && !args.noCompactHeaders,
      changesOnly: args.changesOnly,
    });

    await writeOutput(output, args.output ? String(args.output) : undefined);
  },
});
