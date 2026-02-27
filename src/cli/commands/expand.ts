import { basename, extname, join } from 'node:path';
import { defineCommand } from 'citty';
import { expand } from '../../core/expand.js';
import { readInput, resolveInputPaths, writeOutput } from '../io.js';

function toMdFileName(inputPath: string): string {
  const name = basename(inputPath, extname(inputPath));
  return `${name}.md`;
}

export const expandCommand = defineCommand({
  meta: {
    name: 'expand',
    description: 'Expand compact format back to markdown.',
  },
  args: {
    input: {
      type: 'positional',
      description: 'Input compact file path or glob. Omit to read from stdin.',
      required: false,
    },
    output: {
      type: 'string',
      alias: 'o',
      required: false,
    },
    outDir: {
      type: 'string',
      required: false,
    },
    tableDelimiter: {
      type: 'string',
      default: ',',
    },
  },
  async run({ args }) {
    if (!args.input) {
      const compactText = await readInput();
      const markdown = expand(compactText, { tableDelimiter: String(args.tableDelimiter) });
      await writeOutput(markdown, args.output ? String(args.output) : undefined);
      return;
    }

    const paths = await resolveInputPaths(String(args.input));
    if (paths.length === 0) {
      throw new Error(`No files matched: ${String(args.input)}`);
    }

    if (paths.length > 1 && args.output) {
      throw new Error('Cannot use --output with multiple input files. Use --out-dir.');
    }

    for (const filePath of paths) {
      const compactText = await readInput(filePath);
      const markdown = expand(compactText, { tableDelimiter: String(args.tableDelimiter) });

      const targetPath = args.outDir
        ? join(String(args.outDir), toMdFileName(filePath))
        : args.output
          ? String(args.output)
          : undefined;

      await writeOutput(markdown, targetPath);
    }
  },
});
