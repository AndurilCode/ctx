import { basename, extname, join } from 'node:path';
import { defineCommand } from 'citty';
import { compact } from '../../core/compact.js';
import { computeStats } from '../../utils/stats.js';
import { createTokenCounter } from '../../utils/tokens.js';
import { readInput, resolveInputPaths, writeOutput } from '../io.js';
import { parseSectionOptions } from '../section-options.js';

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
    only: {
      type: 'string',
      required: false,
      description: 'Keep only sections whose heading matches this query.',
    },
    strip: {
      type: 'string',
      required: false,
      description: 'Remove sections whose heading matches this query.',
    },
    unwrap: {
      type: 'boolean',
      default: false,
      description: 'Collapse soft line breaks inside paragraphs.',
    },
    stats: {
      type: 'boolean',
      default: false,
    },
    tableDelimiter: {
      type: 'string',
      default: ',',
    },
    versionMarker: {
      type: 'boolean',
      default: false,
    },
    noVersionMarker: {
      type: 'boolean',
      default: false,
    },
  },
  async run({ args }) {
    const onlySections = parseSectionOptions(args.only);
    const stripSections = parseSectionOptions(args.strip);

    if (!args.input) {
      const markdown = await readInput();
      const result = compact(markdown, {
        dedup: args.dedup,
        semantic: args.semantic,
        keepComments: args.keepComments,
        onlySections,
        stripSections,
        unwrapLines: args.unwrap,
        tableDelimiter: String(args.tableDelimiter),
        stats: args.stats,
        versionMarker: args.versionMarker && !args.noVersionMarker,
      });

      await writeOutput(result.output, args.output ? String(args.output) : undefined);

      if (result.stats) {
        const tokenCounter = await createTokenCounter();
        const stats = computeStats(markdown, result.output, result.stats.stageStats, tokenCounter);
        process.stderr.write(`${JSON.stringify(stats, null, 2)}\n`);
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
        dedup: args.dedup,
        semantic: args.semantic,
        keepComments: args.keepComments,
        onlySections,
        stripSections,
        unwrapLines: args.unwrap,
        tableDelimiter: String(args.tableDelimiter),
        stats: args.stats,
        versionMarker: args.versionMarker && !args.noVersionMarker,
      });

      const targetPath = args.outDir
        ? join(String(args.outDir), toCmdFileName(filePath))
        : args.output
          ? String(args.output)
          : undefined;

      await writeOutput(result.output, targetPath);

      if (result.stats) {
        const tokenCounter = await createTokenCounter();
        const stats = computeStats(markdown, result.output, result.stats.stageStats, tokenCounter);
        process.stderr.write(`${filePath}\n${JSON.stringify(stats, null, 2)}\n`);
      }
    }
  },
});
