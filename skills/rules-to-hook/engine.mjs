#!/usr/bin/env node
// Hook engine: inject additionalContext based on .claude/context-rules.json

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { minimatch } from 'minimatch';
import { extractInput, pickString, buildOutput } from './platform.mjs';

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);

let input;
try {
  input = JSON.parse(Buffer.concat(chunks).toString());
} catch {
  process.exit(0);
}

// VS Code doesn't include event name in payload; accept it as CLI argument
const cliEvent = process.argv[2] || '';
const { platform, event, toolName, toolInput, prompt } = extractInput(input, cliEvent);

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

const rawPath = pickString(toolInput.file_path, toolInput.path, toolInput.filePath);
const cwd = process.cwd();
const filePath = rawPath.startsWith(cwd) ? rawPath.slice(cwd.length + 1) : rawPath;
const command = pickString(toolInput.command, toolInput.cmd, toolInput.shellCommand);

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
  if (inject.block) return { type: 'block', value: inject.block };
  if (inject.allow) return { type: 'allow', value: inject.allow };
  if (inject.text) return { type: 'context', value: inject.text };
  if (inject.hint) return { type: 'context', value: `Related: ${inject.hint}` };
  if (inject.learnings) {
    if (!filePath) return null;
    const learningsPath = `${process.cwd()}/.claude/learnings.json`;
    if (!existsSync(learningsPath)) return null;
    try {
      const learnings = JSON.parse(readFileSync(learningsPath, 'utf8'));
      if (!Array.isArray(learnings)) return null;
      const hits = learnings.filter((entry) =>
        Array.isArray(entry.files) &&
        entry.files.some((pattern) => minimatch(filePath, pattern)),
      );
      if (hits.length === 0) return null;
      const lines = hits.map((h) => `- ${h.learning}`);
      return { type: 'context', value: `[Learnings for ${filePath}]\n${lines.join('\n')}` };
    } catch {
      return null;
    }
  }
  if (inject.shell) {
    try {
      const out = execSync(inject.shell, {
        encoding: 'utf8',
        timeout: 5000,
        maxBuffer: 128 * 1024,
      }).trim();
      return out ? { type: 'context', value: out } : null;
    } catch {
      return null;
    }
  }
  return null;
}

const matched = rules
  .filter((r) => r.on === event && r.inject && matchesWhen(r.when ?? {}))
  .map((r) => resolveInject(r.inject))
  .filter(Boolean);

if (matched.length === 0) process.exit(0);

const isPreToolUse = event === 'PreToolUse';
const blocks = isPreToolUse ? matched.filter((m) => m.type === 'block') : [];
const allows = isPreToolUse ? matched.filter((m) => m.type === 'allow') : [];
const contexts = matched.filter((m) => m.type === 'context');

if (blocks.length === 0 && allows.length === 0 && contexts.length === 0) {
  process.exit(0);
}

const additionalContext = contexts.map((m) => m.value).join('\n') || undefined;
const output = buildOutput({ platform, event, blocks, allows, additionalContext });
if (output === null) process.exit(0);
if (typeof output === 'string') process.stdout.write(output);
else process.stdout.write(JSON.stringify(output));
