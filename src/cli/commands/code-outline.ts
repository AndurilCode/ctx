import { defineCommand } from 'citty';
import { codeOutline } from '../../core/code-outline.js';
import { readInput, writeOutput } from '../io.js';

export const codeOutlineCommand = defineCommand({
  meta: {
    name: 'code-outline',
    description: 'Parse source code and emit a structural outline.',
  },
  args: {
    input: {
      type: 'positional',
      required: false,
      description: 'Input source file. Omit to read from stdin.',
    },
    output: {
      type: 'string',
      alias: 'o',
      required: false,
      description: 'Output file path. Omit to write to stdout.',
    },
    depth: {
      type: 'string',
      required: false,
      description: 'Maximum nesting depth to show.',
    },
    language: {
      type: 'string',
      required: false,
      description: 'Force language instead of extension auto-detection.',
    },
    'collapse-imports': {
      type: 'boolean',
      required: false,
      default: true,
      description: 'Collapse all imports into a single summary line.',
    },
  },
  async run({ args }) {
    const inputPath = args.input ? String(args.input) : undefined;
    const source = await readInput(inputPath);
    const result = await codeOutline(source, {
      filePath: inputPath,
      language: args.language ? String(args.language) : undefined,
      depth: args.depth ? Number(args.depth) : undefined,
      collapseImports: args['collapse-imports'],
    });
    await writeOutput(result.output, args.output ? String(args.output) : undefined);
  },
});
