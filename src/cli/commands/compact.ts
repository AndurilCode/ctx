import { basename, extname, join } from 'node:path';
import { defineCommand } from 'citty';
import { compact } from '../../core/compact.js';
import { readInput, resolveInputPaths, writeOutput } from '../io.js';

function toCmdFileName(inputPath: string): string {
  const name = basename(inputPath, extname(inputPath));
  return `${name}.cmd`;
}

export const compactCommand = defineCommand({
  meta: {
    name: 'pack',
    description: 'Compress markdown into compact.md format.',
  },
  args: {
    input: {
      type: 'positional',
      description: 'Input markdown file path or glob. Omit to read from stdin.',
      required: false,
    },
    output: {
      type: 'string',
      alias: 'o',
      description: 'Output file path for single-input mode.',
      required: false,
    },
    outDir: {
      type: 'string',
      description: 'Output directory for glob/batch mode.',
      required: false,
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
    stats: {
      type: 'boolean',
      default: false,
    },
    tableDelimiter: {
      type: 'string',
      default: ',',
    },
    noVersionMarker: {
      type: 'boolean',
      default: false,
    },
  },
  async run({ args }) {
    if (!args.input) {
      const markdown = await readInput();
      const result = compact(markdown, {
        dedup: Boolean(args.dedup),
        semantic: Boolean(args.semantic),
        keepComments: Boolean(args.keepComments),
        tableDelimiter: String(args.tableDelimiter),
        stats: Boolean(args.stats),
        versionMarker: !args.noVersionMarker,
      });

      const output = typeof result === 'string' ? result : result.output;
      await writeOutput(output, args.output ? String(args.output) : undefined);

      if (typeof result !== 'string') {
        process.stderr.write(`${JSON.stringify(result.stats, null, 2)}\n`);
      }
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
      const markdown = await readInput(filePath);
      const result = compact(markdown, {
        dedup: Boolean(args.dedup),
        semantic: Boolean(args.semantic),
        keepComments: Boolean(args.keepComments),
        tableDelimiter: String(args.tableDelimiter),
        stats: Boolean(args.stats),
        versionMarker: !args.noVersionMarker,
      });

      const output = typeof result === 'string' ? result : result.output;
      const targetPath = args.outDir
        ? join(String(args.outDir), toCmdFileName(filePath))
        : args.output
          ? String(args.output)
          : undefined;

      await writeOutput(output, targetPath);

      if (typeof result !== 'string') {
        process.stderr.write(`${filePath}\n${JSON.stringify(result.stats, null, 2)}\n`);
      }
    }
  },
});
