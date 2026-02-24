import { defineCommand } from 'citty';
import { verify } from '../../core/verify.js';
import { readInput } from '../io.js';

export const verifyCommand = defineCommand({
  meta: {
    name: 'verify',
    description: 'Verify round-trip compact(expand(markdown)) behavior.',
  },
  args: {
    input: {
      type: 'positional',
      required: false,
      description: 'Input markdown path. Omit to read from stdin.',
    },
    tableDelimiter: {
      type: 'string',
      default: ',',
    },
  },
  async run({ args }) {
    const markdown = await readInput(args.input ? String(args.input) : undefined);
    const ok = verify(markdown, { tableDelimiter: String(args.tableDelimiter) });

    process.stdout.write(`${ok ? 'ok' : 'failed'}\n`);
    if (!ok) {
      process.exitCode = 1;
    }
  },
});
