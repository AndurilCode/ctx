import { defineCommand } from 'citty';
import { tree } from '../../core/tree.js';

export const treeCommand = defineCommand({
  meta: {
    name: 'tree',
    description: 'Directory tree with per-file token counts.',
  },
  args: {
    path: { type: 'positional', required: false, description: 'Directory path (default: cwd)' },
    glob: { type: 'string', required: false, description: 'Filter pattern, e.g. "**/*.ts"' },
    depth: { type: 'string', required: false, default: '3', description: 'Max directory depth' },
    concurrency: {
      type: 'string',
      required: false,
      default: '16',
      description: 'Max concurrent filesystem workers',
    },
  },
  async run({ args }) {
    const result = await tree({
      path: args.path ? String(args.path) : undefined,
      glob: args.glob ? String(args.glob) : undefined,
      depth: Number(args.depth),
      concurrency: Number(args.concurrency),
    });
    process.stdout.write(
      `${result.root} (${result.totalTokens} tokens, ${result.totalFiles} files)\n\n`,
    );
    process.stdout.write(result.output);
    process.stdout.write('\n');
  },
});
