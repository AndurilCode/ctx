import { defineCommand } from 'citty';
import { assembleContext } from '../../core/context.js';
import type { ContextSource } from '../../types/context.js';
import type { ReadStrategy } from '../../types/read.js';

export const contextCommand = defineCommand({
  meta: {
    name: 'context',
    description: 'Assemble a context document from multiple files within a token budget.',
  },
  args: {
    files: { type: 'positional', required: true, description: 'File paths (space-separated)' },
    maxTokens: { type: 'string', required: true, description: 'Total token budget' },
    strategy: { type: 'string', required: false, default: 'auto', description: 'auto|truncate|outline|sections' },
  },
  async run({ args }) {
    // citty puts ALL positional args in args._ (including the first named one)
    const fileList = Array.isArray(args._) ? (args._ as string[]).filter(Boolean) : [String(args.files)];
    const sources: ContextSource[] = fileList.map((f) => ({ file: String(f) }));

    const result = await assembleContext({
      sources,
      maxTokens: Number(args.maxTokens),
      strategy: String(args.strategy) as ReadStrategy,
    });

    process.stdout.write(result.content);
    if (!result.content.endsWith('\n')) process.stdout.write('\n');
    process.stderr.write(
      JSON.stringify({ totalTokens: result.totalTokens, budget: result.budget, sources: result.sources }, null, 2) + '\n',
    );
  },
});
