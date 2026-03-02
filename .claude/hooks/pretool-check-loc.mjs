#!/usr/bin/env node
// PreToolUse hook: block Write/Edit/MultiEdit if the result would exceed 200 lines.

import { readFileSync } from 'node:fs';

const CODE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.rb',
  '.go',
  '.rs',
  '.java',
  '.kt',
  '.swift',
  '.c',
  '.cpp',
  '.cc',
  '.h',
  '.hpp',
  '.sh',
  '.bash',
  '.zsh',
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.vue',
  '.svelte',
  '.php',
  '.cs',
  '.fs',
]);

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);

let input;
try {
  input = JSON.parse(Buffer.concat(chunks).toString());
} catch {
  process.exit(0);
}

const toolName = input?.tool_name ?? '';
const ti = input?.tool_input ?? {};

const filePath = ti.file_path ?? ti.path ?? null;
if (!filePath || typeof filePath !== 'string') process.exit(0);

const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
if (!CODE_EXTENSIONS.has(ext)) process.exit(0);

let projected;

if (toolName === 'Write') {
  projected = (ti.content ?? '').split('\n').length;
} else if (toolName === 'Edit') {
  let current;
  try {
    current = readFileSync(filePath, 'utf8');
  } catch {
    process.exit(0); // new file — Write will handle it
  }
  const currentLines = current.split('\n').length;
  const removed = (ti.old_string ?? '').split('\n').length;
  const added = (ti.new_string ?? '').split('\n').length;
  projected = currentLines - removed + added;
} else if (toolName === 'MultiEdit') {
  let current;
  try {
    current = readFileSync(filePath, 'utf8');
  } catch {
    process.exit(0);
  }
  let delta = 0;
  for (const edit of ti.edits ?? []) {
    delta += (edit.new_string ?? '').split('\n').length;
    delta -= (edit.old_string ?? '').split('\n').length;
  }
  projected = current.split('\n').length + delta;
} else {
  process.exit(0);
}

if (projected <= 200) process.exit(0);

const result = {
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason:
      `[LOC guard] This edit would bring ${filePath} to ~${projected} lines, ` +
      `exceeding the 200-line limit enforced by AGENTS.md. ` +
      `Split the file into smaller modules instead.`,
  },
};

process.stdout.write(JSON.stringify(result));
