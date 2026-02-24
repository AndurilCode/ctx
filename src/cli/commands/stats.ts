import { defineCommand } from 'citty';
import { compact } from '../../core/compact.js';
import { computeStats } from '../../utils/stats.js';
import { createTokenCounter } from '../../utils/tokens.js';
import { readInput } from '../io.js';
import { parseSectionOptions } from '../section-options.js';

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
    only: {
      type: 'string',
      required: false,
      description: 'Keep only sections whose heading matches this query.',
    },
    strip: {
      type: 'string',
      required: false,
      description: 'Remove sections whose heading matches this query.',
    },
    unwrap: {
      type: 'boolean',
      default: false,
      description: 'Collapse soft line breaks inside paragraphs.',
    },
    tableDelimiter: {
      type: 'string',
      default: ',',
    },
  },
  async run({ args }) {
    const onlySections = parseSectionOptions(args.only);
    const stripSections = parseSectionOptions(args.strip);

    const markdown = await readInput(args.input ? String(args.input) : undefined);
    const result = compact(markdown, {
      stats: true,
      dedup: args.dedup,
      semantic: args.semantic,
      keepComments: args.keepComments,
      onlySections,
      stripSections,
      unwrapLines: args.unwrap,
      tableDelimiter: String(args.tableDelimiter),
    });
    if (!result.stats) {
      throw new Error('Expected stats payload from compact()');
    }

    const tokenCounter = await createTokenCounter();
    const stats = computeStats(markdown, result.output, result.stats.stageStats, tokenCounter);

    process.stdout.write(`${JSON.stringify(stats, null, 2)}\n`);
  },
});
