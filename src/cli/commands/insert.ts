import { defineCommand } from 'citty';
import { insert } from '../../core/insert.js';
import { readInput } from '../io.js';

export const insertCommand = defineCommand({
  meta: {
    name: 'insert',
    description: 'Insert a new symbol into a source file at a specified position.',
  },
  args: {
    file: { type: 'positional', required: true, description: 'Path to source file' },
    position: { type: 'string', required: true, description: "'after:<symbol>', 'before:<symbol>', 'after-imports', 'end-of-file', 'start-of-file'" },
    anchorHash: { type: 'string', required: false, description: 'Hash of anchor symbol from outline' },
    body: { type: 'string', required: false, description: 'New symbol definition (or read from stdin if omitted)' },
    dryRun: { type: 'boolean', default: false, description: 'Return diff without writing' },
  },
  async run({ args }) {
    const body = args.body ? String(args.body) : await readInput(undefined);
    const result = await insert({
      file: String(args.file),
      position: String(args.position),
      anchor_hash: args.anchorHash ? String(args.anchorHash) : undefined,
      body,
      dryRun: args.dryRun,
    });
    if (result.ok) {
      process.stdout.write(`${result.linesChanged} lines added\n`);
      if (result.updatedOutline) process.stdout.write('--- Updated outline ---\n' + result.updatedOutline + '\n');
    } else {
      process.stderr.write(`ERROR: ${result.error.code} — ${result.error.message}\n`);
      if (result.error.freshOutline) process.stderr.write('--- Fresh outline ---\n' + result.error.freshOutline + '\n');
      process.exit(1);
    }
  },
});
