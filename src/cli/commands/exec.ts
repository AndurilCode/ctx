import { defineCommand } from 'citty';
import { readInput } from '../io.js';
import { executeCode } from '../../core/exec/index.js';

export const execCommand = defineCommand({
  meta: {
    name: 'exec',
    description: 'Execute a JS code block with ctx API pre-loaded.',
  },
  args: {
    code: {
      type: 'positional',
      required: false,
      description: 'Inline code string (alternative to stdin/file)',
    },
    file: {
      type: 'string',
      required: false,
      description: 'File containing code to execute',
    },
    timeout: {
      type: 'string',
      required: false,
      default: '30000',
      description: 'Timeout in ms (max 120000)',
    },
    maxOutputTokens: {
      type: 'string',
      required: false,
      default: '50000',
      description: 'Max output tokens',
    },
    'allow-write': {
      type: 'boolean',
      required: false,
      default: false,
      description: 'Enable write operations (patch, insert, rename)',
    },
  },
  async run({ args }) {
    let code: string;
    if (args.code) {
      code = String(args.code);
    } else {
      code = await readInput(args.file ? String(args.file) : undefined);
    }
    if (!code.trim()) {
      process.stderr.write('Error: no code provided\n');
      process.exitCode = 1;
      return;
    }

    const result = await executeCode({
      code,
      timeout: Number(args.timeout),
      maxOutputTokens: Number(args.maxOutputTokens),
      allowWrite: args['allow-write'] as boolean,
    });

    if (result.output) {
      process.stdout.write(result.output);
      if (!result.output.endsWith('\n')) {
        process.stdout.write('\n');
      }
    }

    if (result.error) {
      process.stderr.write(`${result.error.name}: ${result.error.message}\n`);
    }

    process.exitCode = result.success ? 0 : 1;
  },
});
