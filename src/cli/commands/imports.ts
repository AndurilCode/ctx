import { defineCommand } from 'citty';
import { fileImports } from '../../core/imports.js';

export const importsCommand = defineCommand({
  meta: {
    name: 'imports',
    description: 'Show import/dependency graph for a file.',
  },
  args: {
    file: { type: 'positional', required: true, description: 'File path to analyze' },
    direction: {
      type: 'string',
      required: false,
      default: 'both',
      description: 'both|incoming|outgoing',
    },
    concurrency: {
      type: 'string',
      required: false,
      default: '16',
      description: 'Max concurrent filesystem workers',
    },
  },
  async run({ args }) {
    const result = await fileImports({
      file: String(args.file),
      direction: String(args.direction) as 'both' | 'incoming' | 'outgoing',
      concurrency: Number(args.concurrency),
    });
    process.stdout.write(result.output);
    process.stdout.write('\n');
  },
});
