import { defineCommand } from 'citty';
import { relevance } from '../../core/relevance.js';

export const relevanceCommand = defineCommand({
  meta: {
    name: 'relevance',
    description: 'Rank files by relevance to a query.',
  },
  args: {
    query: { type: 'positional', required: true, description: 'Query string' },
    files: { type: 'positional', required: false, description: 'File paths to rank' },
    maxResults: { type: 'string', required: false, default: '10', description: 'Max results' },
  },
  async run({ args }) {
    const query = String(args.query);
    const fileList = Array.isArray(args.files)
      ? (args.files as string[])
      : args.files
        ? [String(args.files)]
        : [];
    const result = await relevance({ query, files: fileList, maxResults: Number(args.maxResults) });
    process.stdout.write(JSON.stringify(result, null, 2));
    process.stdout.write('\n');
  },
});
