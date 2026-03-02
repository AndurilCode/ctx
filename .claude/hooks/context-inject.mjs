#!/usr/bin/env node
// Hook engine: inject additionalContext based on .claude/context-rules.json

import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { minimatch } from 'minimatch';

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);

let input;
try {
  input = JSON.parse(Buffer.concat(chunks).toString());
} catch {
  process.exit(0);
}

const event = input?.hook_event_name ?? '';
const toolName = input?.tool_name ?? '';
const toolInput = input?.tool_input ?? {};
const prompt = input?.prompt ?? '';

const configCandidates = [
  `${process.cwd()}/.claude/context-rules.json`,
  `${process.cwd()}/context-rules.json`,
  new URL('../context-rules.json', import.meta.url).pathname,
];
const configPath = configCandidates.find(existsSync);
if (!configPath) process.exit(0);

let rules;
try {
  rules = JSON.parse(readFileSync(configPath, 'utf8'));
} catch {
  process.exit(0);
}

if (!Array.isArray(rules)) process.exit(0);

const rawPath = toolInput.file_path ?? toolInput.path ?? '';
const cwd = process.cwd();
const filePath = rawPath.startsWith(cwd) ? rawPath.slice(cwd.length + 1) : rawPath;
const command = toolInput.command ?? toolInput.cmd ?? '';

function safeRegex(pattern) {
  try {
    return new RegExp(pattern);
  } catch {
    return null;
  }
}

function matchesWhen(when) {
  if (when.tool) {
    const re = safeRegex(`^(${when.tool})$`);
    if (!re || !re.test(toolName)) return false;
  }
  if (when.path) {
    if (!filePath || !minimatch(filePath, when.path)) return false;
  }
  if (when.command) {
    const re = safeRegex(when.command);
    if (!command || !re || !re.test(command)) return false;
  }
  if (when.prompt) {
    const re = safeRegex(when.prompt);
    if (!prompt || !re || !re.test(prompt)) return false;
  }
  return true;
}

function resolveInject(inject) {
  if (inject.text) return inject.text;
  if (inject.hint) return `Related: ${inject.hint}`;
  if (inject.shell) {
    try {
      return execSync(inject.shell, {
        encoding: 'utf8',
        timeout: 5000,
        maxBuffer: 128 * 1024,
      }).trim();
    } catch {
      return '';
    }
  }
  return '';
}

const matched = rules
  .filter((r) => r.on === event && r.when && r.inject && matchesWhen(r.when))
  .map((r) => resolveInject(r.inject))
  .filter(Boolean);

if (matched.length === 0) process.exit(0);

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: event,
      additionalContext: matched.join('\n'),
    },
  }),
);
