import { defineCommand, runMain } from 'citty';
import { autoContextCommand } from './commands/auto-context.js';
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
import { reviewCommand } from './commands/review.js';
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
    compact: compactCommand,
    outline: codeOutlineCommand,
    changes: diffCommand,
    prune: pruneLogCommand,
    extract: extractCommand,
    expand: expandCommand,
    verify: verifyCommand,
    metrics: statsCommand,
    sections: sectionsCommand,
    locate: searchSectionsCommand,
    tokens: tokenCountCommand,
    imports: importsCommand,
    symbols: symbolsCommand,
    tree: treeCommand,
    read: readCommand,
    rank: relevanceCommand,
    review: reviewCommand,
    context: contextCommand,
    gather: autoContextCommand,
  },
});

runMain(command);
