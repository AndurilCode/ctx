import { defineCommand } from 'citty';
import { compact } from '../../core/compact.js';
import { readInput } from '../io.js';

export const statsCommand = defineCommand({
  meta: {
    name: 'stats',
    description: 'Show compression stats for markdown input.',
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
    const result = compact(markdown, {
      stats: true,
      tableDelimiter: String(args.tableDelimiter),
    });

    if (typeof result === 'string') {
      throw new Error('Stats were not returned from compact().');
    }

    process.stdout.write(`${JSON.stringify(result.stats, null, 2)}\n`);
  },
});
