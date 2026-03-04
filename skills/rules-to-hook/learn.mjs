#!/usr/bin/env node
// CLI for managing .claude/learnings.json
// Usage:
//   node learn.mjs add     --files <glob,...> --learning <text>
//   node learn.mjs list    [--files <path>]
//   node learn.mjs remove  --index N
//   node learn.mjs update  --index N --learning <text>
//   node learn.mjs repath  --index N --files <glob,...>
//   node learn.mjs check   (find orphaned learnings)

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { minimatch } from 'minimatch';

const STORE = `${process.cwd()}/.claude/learnings.json`;

function readStore() {
  if (!existsSync(STORE)) return [];
  try {
    const data = JSON.parse(readFileSync(STORE, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch { return []; }
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

function fmt(entry, index) {
  return `  [${index}] ${entry.files.join(', ')} — "${entry.learning}"`;
}

function findOverlapping(entries, filePatterns) {
  return entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) =>
      entry.files.some((existingGlob) =>
        filePatterns.some(
          (p) => minimatch(p, existingGlob) || minimatch(existingGlob, p) || existingGlob === p,
        ),
      ),
    );
}

function requireIndex(args, entries) {
  if (args.index === undefined) return null;
  const idx = parseInt(args.index, 10);
  if (idx < 0 || idx >= entries.length) {
    console.error(`Index ${idx} out of range (0-${entries.length - 1}).`);
    process.exit(1);
  }
  return idx;
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
  const overlapping = findOverlapping(entries, filePatterns);
  if (overlapping.length > 0) {
    console.log('Existing learnings for overlapping files:');
    for (const { entry, index } of overlapping) console.log(fmt(entry, index));
    console.log('');
  }
  const newEntry = { files: filePatterns, learning: args.learning, timestamp: new Date().toISOString() };
  entries.push(newEntry);
  writeStore(entries);
  console.log(`Added learning [${entries.length - 1}]: ${filePatterns.join(', ')} — "${args.learning}"`);
} else if (command === 'list') {
  const entries = readStore();
  if (entries.length === 0) { console.log('No learnings recorded.'); process.exit(0); }
  let filtered = entries.map((entry, index) => ({ entry, index }));
  if (args.files) {
    filtered = filtered.filter(({ entry }) =>
      entry.files.some((pattern) => minimatch(args.files, pattern)),
    );
  }
  if (filtered.length === 0) console.log('No learnings match the given path.');
  else for (const { entry, index } of filtered) console.log(fmt(entry, index));
} else if (command === 'remove') {
  const entries = readStore();
  const idx = requireIndex(args, entries);
  if (idx === null) { console.error('Usage: learn.mjs remove --index N'); process.exit(1); }
  const removed = entries.splice(idx, 1)[0];
  writeStore(entries);
  console.log(`Removed learning [${idx}]: "${removed.learning}"`);
} else if (command === 'update') {
  if (!args.learning) { console.error('Usage: learn.mjs update --index N --learning <text>'); process.exit(1); }
  const entries = readStore();
  const idx = requireIndex(args, entries);
  if (idx === null) { console.error('Usage: learn.mjs update --index N --learning <text>'); process.exit(1); }
  entries[idx].learning = args.learning;
  entries[idx].timestamp = new Date().toISOString();
  writeStore(entries);
  console.log(`Updated learning [${idx}]: "${args.learning}"`);
} else if (command === 'repath') {
  if (!args.files) { console.error('Usage: learn.mjs repath --index N --files <glob,...>'); process.exit(1); }
  const entries = readStore();
  const idx = requireIndex(args, entries);
  if (idx === null) { console.error('Usage: learn.mjs repath --index N --files <glob,...>'); process.exit(1); }
  const oldFiles = entries[idx].files.join(', ');
  entries[idx].files = args.files.split(',').map((s) => s.trim());
  entries[idx].timestamp = new Date().toISOString();
  writeStore(entries);
  console.log(`Repathed learning [${idx}]: ${oldFiles} → ${entries[idx].files.join(', ')}`);
} else if (command === 'check') {
  const entries = readStore();
  if (entries.length === 0) { console.log('No learnings to check.'); process.exit(0); }
  let allFiles;
  try {
    allFiles = execSync('git ls-files', { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  } catch { console.error('Not a git repo or git unavailable.'); process.exit(1); }
  let orphaned = 0;
  for (let i = 0; i < entries.length; i++) {
    const hasMatch = entries[i].files.some((p) => allFiles.some((f) => minimatch(f, p)));
    if (!hasMatch) { console.log(`  [${i}] ORPHANED — ${entries[i].files.join(', ')} — "${entries[i].learning}"`); orphaned++; }
  }
  if (orphaned === 0) console.log('All learnings have matching files.');
  else console.log(`\n${orphaned} orphaned learning(s). Use repath or remove to fix.`);
} else {
  console.error('Commands: add | list | remove | update | repath | check');
  console.error('  add    --files <glob,...> --learning <text>');
  console.error('  list   [--files <path>]');
  console.error('  remove --index <N>');
  console.error('  update --index <N> --learning <text>');
  console.error('  repath --index <N> --files <glob,...>');
  console.error('  check  (find orphaned learnings with no matching files)');
  process.exit(1);
}
