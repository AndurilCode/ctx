import { defineCommand } from 'citty';
import { patch } from '../../core/patch.js';
import { readInput } from '../io.js';

export const patchCommand = defineCommand({
  meta: {
    name: 'patch',
    description: 'Replace a named symbol in a source file using hash-verified patching.',
  },
  args: {
    file: { type: 'positional', required: true, description: 'Path to source file' },
    symbol: { type: 'string', required: false, description: 'Symbol name from outline' },
    hash: { type: 'string', required: false, description: 'Content hash from outline' },
    body: {
      type: 'string',
      required: false,
      description: 'New implementation (or read from stdin if omitted)',
    },
    lines: {
      type: 'string',
      required: false,
      description: 'JSON array of line-hash edits [{hash,replace?,after?,before?,delete?}]',
    },
    language: { type: 'string', required: false, description: 'Force language detection' },
    dryRun: { type: 'boolean', default: false, description: 'Return diff without writing' },
  },
  async run({ args }) {
    const lines = args.lines ? JSON.parse(String(args.lines)) : undefined;
    const body = !lines && args.body ? String(args.body) : !lines ? await readInput(undefined) : undefined;
    const result = await patch({
      file: String(args.file),
      symbol: args.symbol ? String(args.symbol) : undefined,
      hash: args.hash ? String(args.hash) : undefined,
      body,
      lines,
      language: args.language ? String(args.language) : undefined,
      dryRun: args.dryRun,
    });
    if (result.ok) {
      process.stdout.write(`${result.linesChanged} lines changed\n`);
      if (result.diff) process.stdout.write(`${result.diff}\n`);
      if (result.updatedOutline)
        process.stdout.write(`--- Updated outline ---\n${result.updatedOutline}\n`);
    } else {
      process.stderr.write(`ERROR: ${result.error.code} — ${result.error.message}\n`);
      if (result.error.freshOutline)
        process.stderr.write(`--- Fresh outline ---\n${result.error.freshOutline}\n`);
      process.exit(1);
    }
  },
});
