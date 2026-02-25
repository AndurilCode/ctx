import { defineCommand } from 'citty';
import fg from 'fast-glob';
import { relevance } from '../../core/relevance.js';

export const relevanceCommand = defineCommand({
  meta: {
    name: 'relevance',
    description: 'Rank files by relevance to a query.',
  },
  args: {
    query: { type: 'positional', required: true, description: 'Query string' },
    glob: { type: 'string', required: false, description: 'Glob pattern to match files, e.g. "src/**/*.ts"' },
    maxResults: { type: 'string', required: false, default: '10', description: 'Max results' },
  },
  async run({ args }) {
    const query = String(args.query);
    const globPattern = args.glob ? String(args.glob) : '**/*.{ts,tsx,js,jsx,md}';
    const files = await fg(globPattern, { ignore: ['node_modules/**', 'dist/**'] });
    const result = await relevance({ query, files, maxResults: Number(args.maxResults) });
    process.stdout.write(JSON.stringify(result, null, 2));
    process.stdout.write('\n');
  },
});
