import { defineCommand } from 'citty';
import { extract } from '../../core/extract.js';
import { parseFrontmatter } from '../../utils/frontmatter.js';
import { readInput, writeOutput } from '../io.js';
import { parseSectionOptions } from '../section-options.js';

export const extractCommand = defineCommand({
  meta: {
    name: 'extract',
    description: 'Create a lossy markdown summary for reading.',
  },
  args: {
    input: {
      type: 'positional',
      required: false,
      description: 'Input markdown path. Omit to read from stdin.',
    },
    output: {
      type: 'string',
      alias: 'o',
      required: false,
      description: 'Output file path. Omit to write to stdout.',
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
    maxChars: {
      type: 'string',
      required: false,
      default: '200',
      description: 'Maximum characters per paragraph.',
    },
    maxListItems: {
      type: 'string',
      required: false,
      default: '3',
      description: 'Maximum items per list.',
    },
    maxTableRows: {
      type: 'string',
      required: false,
      default: '2',
      description: 'Maximum data rows per table.',
    },
  },
  async run({ args }) {
    const markdown = await readInput(args.input ? String(args.input) : undefined);
    const fm = parseFrontmatter(markdown);
    if (Object.keys(fm).length > 0) {
      process.stderr.write(`[frontmatter] ${JSON.stringify(fm)}\n`);
    }
    const onlySections = parseSectionOptions(args.only);
    const stripSections = parseSectionOptions(args.strip);

    const output = extract(markdown, {
      onlySections,
      stripSections,
      maxChars: Number(args.maxChars),
      maxListItems: Number(args.maxListItems),
      maxTableRows: Number(args.maxTableRows),
    });

    await writeOutput(output, args.output ? String(args.output) : undefined);
  },
});
