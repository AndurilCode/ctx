import { defineCommand, runMain } from 'citty';
import { codeOutlineCommand } from './commands/code-outline.js';
import { contextCommand } from './commands/context.js';
import { compactCommand } from './commands/compact.js';
import { diffCommand } from './commands/diff.js';
import { expandCommand } from './commands/expand.js';
import { extractCommand } from './commands/extract.js';
import { importsCommand } from './commands/imports.js';
import { pruneLogCommand } from './commands/prune-log.js';
import { readCommand } from './commands/read.js';
import { relevanceCommand } from './commands/relevance.js';
import { searchSectionsCommand } from './commands/search-sections.js';
import { sectionsCommand } from './commands/sections.js';
import { statsCommand } from './commands/stats.js';
import { symbolsCommand } from './commands/symbols.js';
import { tokenCountCommand } from './commands/token-count.js';
import { treeCommand } from './commands/tree.js';
import { verifyCommand } from './commands/verify.js';

export const command = defineCommand({
  meta: {
    name: 'compact.md',
    version: '0.1.0',
    description: 'Token-efficient markdown compressor and expander.',
  },
  subCommands: {
    pack: compactCommand,
    'code-outline': codeOutlineCommand,
    diff: diffCommand,
    'prune-log': pruneLogCommand,
    extract: extractCommand,
    unpack: expandCommand,
    verify: verifyCommand,
    stats: statsCommand,
    sections: sectionsCommand,
    'search-sections': searchSectionsCommand,
    'token-count': tokenCountCommand,
    imports: importsCommand,
    symbols: symbolsCommand,
    tree: treeCommand,
    read: readCommand,
    relevance: relevanceCommand,
    context: contextCommand,
  },
});

runMain(command);
