import { defineCommand } from 'citty';
import { rename } from '../../core/rename.js';

export const renameCommand = defineCommand({
  meta: {
    name: 'rename',
    description: 'Rename a symbol across its definition and all call sites.',
  },
  args: {
    file: { type: 'positional', required: true, description: 'File containing the definition' },
    symbol: { type: 'string', required: true, description: 'Current symbol name' },
    hash: { type: 'string', required: true, description: 'Hash of the definition from outline' },
    to: { type: 'string', required: true, description: 'New symbol name' },
    scope: {
      type: 'string',
      required: false,
      description: 'Glob to limit reference search (default: entire repo)',
    },
    dryRun: { type: 'boolean', default: false, description: 'Return summary without writing' },
  },
  async run({ args }) {
    const result = await rename({
      file: String(args.file),
      symbol: String(args.symbol),
      hash: String(args.hash),
      to: String(args.to),
      scope: args.scope ? String(args.scope) : undefined,
      dryRun: args.dryRun,
    });
    if (result.ok) {
      process.stdout.write(`${result.summary}\n`);
    } else {
      process.stderr.write(`ERROR: ${result.error.code} — ${result.error.message}\n`);
      if (result.error.freshOutline)
        process.stderr.write(`--- Fresh outline ---\n${result.error.freshOutline}\n`);
      process.exit(1);
    }
  },
});
