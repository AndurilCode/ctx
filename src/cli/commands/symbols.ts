import { defineCommand } from 'citty';
import { symbols } from '../../core/symbols.js';
import type { OutlineNodeKind } from '../../types/outline.js';

export const symbolsCommand = defineCommand({
  meta: {
    name: 'symbols',
    description: 'Cross-file symbol search.',
  },
  args: {
    query: { type: 'positional', required: true, description: 'Symbol name to search for' },
    path: { type: 'string', required: false, description: 'Directory to search (default: cwd)' },
    glob: { type: 'string', required: false, description: 'File filter, e.g. "**/*.ts"' },
    kind: {
      type: 'string',
      required: false,
      description: 'Filter by kind: function|class|interface|type|enum|variable',
    },
  },
  async run({ args }) {
    const result = await symbols({
      query: String(args.query),
      path: args.path ? String(args.path) : undefined,
      glob: args.glob ? String(args.glob) : undefined,
      kind: args.kind ? (String(args.kind) as OutlineNodeKind) : undefined,
    });
    process.stdout.write(result.output);
    process.stdout.write('\n');
  },
});
