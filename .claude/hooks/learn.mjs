#!/usr/bin/env node
// CLI for managing .claude/learnings.json
// Usage:
//   node learn.mjs add --files 'glob1,glob2' --learning 'text'
//   node learn.mjs list [--files 'path-to-match']
//   node learn.mjs remove --index N
//   node learn.mjs update --index N --learning 'new text'

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { minimatch } from 'minimatch';

const STORE = `${process.cwd()}/.claude/learnings.json`;

function readStore() {
  if (!existsSync(STORE)) return [];
  try {
    const data = JSON.parse(readFileSync(STORE, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeStore(entries) {
  mkdirSync(`${process.cwd()}/.claude`, { recursive: true });
  writeFileSync(STORE, JSON.stringify(entries, null, 2) + '\n');
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--') && i + 1 < argv.length) {
      args[argv[i].slice(2)] = argv[i + 1];
      i++;
    }
  }
  return args;
}

function formatEntry(entry, index) {
  const files = entry.files.join(', ');
  return `  [${index}] ${files} — "${entry.learning}"`;
}

function findOverlapping(entries, filePatterns) {
  return entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) =>
      entry.files.some((existingGlob) =>
        filePatterns.some(
          (newPattern) =>
            minimatch(newPattern, existingGlob) ||
            minimatch(existingGlob, newPattern) ||
            existingGlob === newPattern,
        ),
      ),
    );
}

const [command] = process.argv.slice(2);
const args = parseArgs(process.argv.slice(3));

if (command === 'add') {
  if (!args.files || !args.learning) {
    console.error('Usage: learn.mjs add --files <glob,...> --learning <text>');
    process.exit(1);
  }

  const filePatterns = args.files.split(',').map((s) => s.trim());
  const entries = readStore();

  // Show overlapping existing learnings for curation
  const overlapping = findOverlapping(entries, filePatterns);
  if (overlapping.length > 0) {
    console.log('Existing learnings for overlapping files:');
    for (const { entry, index } of overlapping) {
      console.log(formatEntry(entry, index));
    }
    console.log('');
  }

  const newEntry = {
    files: filePatterns,
    learning: args.learning,
    timestamp: new Date().toISOString(),
  };
  entries.push(newEntry);
  writeStore(entries);
  console.log(`Added learning [${entries.length - 1}]: ${filePatterns.join(', ')} — "${args.learning}"`);
} else if (command === 'list') {
  const entries = readStore();
  if (entries.length === 0) {
    console.log('No learnings recorded.');
    process.exit(0);
  }

  let filtered = entries.map((entry, index) => ({ entry, index }));
  if (args.files) {
    const matchPath = args.files;
    filtered = filtered.filter(({ entry }) =>
      entry.files.some((pattern) => minimatch(matchPath, pattern)),
    );
  }

  if (filtered.length === 0) {
    console.log('No learnings match the given path.');
  } else {
    for (const { entry, index } of filtered) {
      console.log(formatEntry(entry, index));
    }
  }
} else if (command === 'remove') {
  if (args.index === undefined) {
    console.error('Usage: learn.mjs remove --index N');
    process.exit(1);
  }

  const entries = readStore();
  const idx = parseInt(args.index, 10);
  if (idx < 0 || idx >= entries.length) {
    console.error(`Index ${idx} out of range (0-${entries.length - 1}).`);
    process.exit(1);
  }

  const removed = entries.splice(idx, 1)[0];
  writeStore(entries);
  console.log(`Removed learning [${idx}]: "${removed.learning}"`);
} else if (command === 'update') {
  if (args.index === undefined || !args.learning) {
    console.error('Usage: learn.mjs update --index N --learning <text>');
    process.exit(1);
  }

  const entries = readStore();
  const idx = parseInt(args.index, 10);
  if (idx < 0 || idx >= entries.length) {
    console.error(`Index ${idx} out of range (0-${entries.length - 1}).`);
    process.exit(1);
  }

  entries[idx].learning = args.learning;
  entries[idx].timestamp = new Date().toISOString();
  writeStore(entries);
  console.log(`Updated learning [${idx}]: "${args.learning}"`);
} else {
  console.error('Usage: learn.mjs <add|list|remove|update> [options]');
  console.error('  add    --files <glob,...> --learning <text>');
  console.error('  list   [--files <path>]');
  console.error('  remove --index <N>');
  console.error('  update --index <N> --learning <text>');
  process.exit(1);
}
