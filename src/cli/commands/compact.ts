import { basename, extname, join } from 'node:path';
import { defineCommand } from 'citty';
import { compact } from '../../core/compact.js';
import { parseFrontmatter } from '../../utils/frontmatter.js';
import { computeStats } from '../../utils/stats.js';
import { createTokenCounter } from '../../utils/tokens.js';
import { readInput, resolveInputPaths, writeOutput } from '../io.js';
import { parseSectionOptions } from '../section-options.js';

function writeFrontmatterToStderr(markdown: string, label?: string): void {
  const fm = parseFrontmatter(markdown);
  if (Object.keys(fm).length === 0) return;
  const prefix = label ? `${label}\n` : '';
  process.stderr.write(`${prefix}[frontmatter] ${JSON.stringify(fm)}\n`);
}

function toCmdFileName(inputPath: string): string {
  const name = basename(inputPath, extname(inputPath));
  return `${name}.cmd`;
}

interface RunCompactArgs {
  markdown: string;
  compactOptions: Parameters<typeof compact>[1];
  outputPath: string | undefined;
  statsLabel?: string;
}

async function runCompact({
  markdown,
  compactOptions,
  outputPath,
  statsLabel,
}: RunCompactArgs): Promise<void> {
  const result = compact(markdown, compactOptions);
  await writeOutput(result.output, outputPath);
  if (result.stats) {
    const tokenCounter = await createTokenCounter();
    const stats = computeStats(markdown, result.output, result.stats.stageStats, tokenCounter);
    const prefix = statsLabel ? `${statsLabel}\n` : '';
    process.stderr.write(`${prefix}${JSON.stringify(stats, null, 2)}\n`);
  }
}

export const compactCommand = defineCommand({
  meta: {
    name: 'compact',
    description: 'Compress markdown into compact format.',
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
    dedup: { type: 'boolean', default: false },
    semantic: { type: 'boolean', default: false },
    keepComments: { type: 'boolean', default: false },
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
    stats: { type: 'boolean', default: false },
    tableDelimiter: { type: 'string', default: ',' },
    versionMarker: { type: 'boolean', default: false },
    noVersionMarker: { type: 'boolean', default: false },
  },
  async run({ args }) {
    const onlySections = parseSectionOptions(args.only);
    const stripSections = parseSectionOptions(args.strip);
    const compactOptions = {
      dedup: args.dedup,
      semantic: args.semantic,
      keepComments: args.keepComments,
      onlySections,
      stripSections,
      unwrapLines: args.unwrap,
      tableDelimiter: String(args.tableDelimiter),
      stats: args.stats,
      versionMarker: args.versionMarker && !args.noVersionMarker,
    };

    if (!args.input) {
      const markdown = await readInput();
      writeFrontmatterToStderr(markdown);
      await runCompact({
        markdown,
        compactOptions,
        outputPath: args.output ? String(args.output) : undefined,
      });
      return;
    }

    const paths = await resolveInputPaths(String(args.input));
    if (paths.length === 0) throw new Error(`No files matched: ${String(args.input)}`);
    if (paths.length > 1 && args.output)
      throw new Error('Cannot use --output with multiple input files. Use --out-dir.');

    for (const filePath of paths) {
      const markdown = await readInput(filePath);
      writeFrontmatterToStderr(markdown, paths.length > 1 ? filePath : undefined);
      const outputPath = args.outDir
        ? join(String(args.outDir), toCmdFileName(filePath))
        : args.output
          ? String(args.output)
          : undefined;
      await runCompact({ markdown, compactOptions, outputPath, statsLabel: filePath });
    }
  },
});
