import { defineCommand } from 'citty';
import { budgetedRead } from '../../core/read.js';
import type { ReadStrategy } from '../../types/read.js';

export const readCommand = defineCommand({
  meta: {
    name: 'read',
    description: 'Token-budgeted file reading. Returns best representation within token budget.',
  },
  args: {
    file: { type: 'positional', required: true, description: 'File path' },
    maxTokens: { type: 'string', required: false, description: 'Token budget' },
    strategy: {
      type: 'string',
      required: false,
      default: 'auto',
      description: 'auto|truncate|outline|sections|summarize',
    },
  },
  async run({ args }) {
    const result = await budgetedRead({
      file: String(args.file),
      maxTokens: args.maxTokens ? Number(args.maxTokens) : undefined,
      strategy: String(args.strategy) as ReadStrategy,
    });
    process.stdout.write(result.content);
    if (!result.content.endsWith('\n')) process.stdout.write('\n');
    process.stderr.write(
      JSON.stringify(
        {
          strategy: result.strategy,
          totalTokens: result.totalTokens,
          returnedTokens: result.returnedTokens,
          truncated: result.truncated,
        },
        null,
        2,
      ) + '\n',
    );
  },
});
