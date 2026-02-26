import { defineCommand } from 'citty';
import { autoContext } from '../../core/auto-context.js';

export const autoContextCommand = defineCommand({
  meta: {
    name: 'auto-context',
    description: 'Auto-discover and assemble relevant context for a query within a token budget.',
  },
  args: {
    query: { type: 'positional', required: true, description: 'Task description or query' },
    maxTokens: { type: 'string', required: true, description: 'Total token budget' },
    path: { type: 'string', required: false, description: 'Root directory to search (default: cwd)' },
    seeds: { type: 'string', required: false, description: 'Comma-separated seed file paths' },
    depth: { type: 'string', required: false, default: '1', description: 'Import graph hops (0 = none)' },
    glob: { type: 'string', required: false, description: 'File pattern (default: **/*.{ts,tsx,js,jsx})' },
    maxFiles: { type: 'string', required: false, default: '15', description: 'Max files to include' },
  },
  async run({ args }) {
    const seeds = args.seeds
      ? String(args.seeds)
          .split(',')
          .map((seed) => seed.trim())
          .filter(Boolean)
      : undefined;

    const result = await autoContext({
      query: String(args.query),
      maxTokens: Number(args.maxTokens),
      path: args.path ? String(args.path) : undefined,
      seeds,
      depth: Number(args.depth),
      glob: args.glob ? String(args.glob) : undefined,
      maxFiles: Number(args.maxFiles),
    });

    process.stdout.write(result.content);
    if (!result.content.endsWith('\n')) process.stdout.write('\n');
    process.stderr.write(
      JSON.stringify(
        { totalTokens: result.totalTokens, budget: result.budget, selectedFiles: result.selectedFiles },
        null,
        2,
      ) + '\n',
    );
  },
});
