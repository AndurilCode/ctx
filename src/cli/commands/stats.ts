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
    dedup: {
      type: 'boolean',
      default: false,
    },
    semantic: {
      type: 'boolean',
      default: false,
    },
    keepComments: {
      type: 'boolean',
      default: false,
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
      dedup: Boolean(args.dedup),
      semantic: Boolean(args.semantic),
      keepComments: Boolean(args.keepComments),
      tableDelimiter: String(args.tableDelimiter),
    });

    process.stdout.write(`${JSON.stringify(result.stats, null, 2)}\n`);
  },
});
