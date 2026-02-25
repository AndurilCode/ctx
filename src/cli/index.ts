import { defineCommand, runMain } from 'citty';
import { compactCommand } from './commands/compact.js';
import { expandCommand } from './commands/expand.js';
import { extractCommand } from './commands/extract.js';
import { sectionsCommand } from './commands/sections.js';
import { statsCommand } from './commands/stats.js';
import { verifyCommand } from './commands/verify.js';

export const command = defineCommand({
  meta: {
    name: 'compact.md',
    version: '0.1.0',
    description: 'Token-efficient markdown compressor and expander.',
  },
  subCommands: {
    pack: compactCommand,
    extract: extractCommand,
    unpack: expandCommand,
    verify: verifyCommand,
    stats: statsCommand,
    sections: sectionsCommand,
  },
});

runMain(command);
