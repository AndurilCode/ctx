import { defineCommand } from 'citty';
import { tokenCount } from '../../core/token-count.js';
import { readInput } from '../io.js';

export const tokenCountCommand = defineCommand({
  meta: {
    name: 'token-count',
    description: 'Count tokens, bytes, and lines for a file or stdin.',
  },
  args: {
    input: { type: 'positional', required: false, description: 'File path (or pipe via stdin)' },
  },
  async run({ args }) {
    const text = await readInput(args.input ? String(args.input) : undefined);
    const result = await tokenCount({ text });
    process.stdout.write(JSON.stringify(result, null, 2));
    process.stdout.write('\n');
  },
});
