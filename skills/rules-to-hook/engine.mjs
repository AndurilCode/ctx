#!/usr/bin/env node
// Hook engine: inject additionalContext based on .claude/context-rules.json

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { minimatch } from 'minimatch';
import { extractInput, pickString, buildOutput, PERMISSION_EVENTS, DECISION_BLOCK_EVENTS } from './platform.mjs';
import { evaluateHarness } from './harness-eval.mjs';

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
const { platform, event, toolName, toolInput, prompt, source, agentType, error, toolResponse, content, stopHookActive } = extractInput(input, cliEvent);

// Stop safety guard: if stop_hook_active is set, exit silently to prevent infinite loops
if (event === 'Stop' && stopHookActive) process.exit(0);

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

const VALID_EVENTS = new Set([
  'PreToolUse',
  'PostToolUse',
  'UserPromptSubmit',
  'SessionStart',
  'SubagentStart',
  'PostToolUseFailure',
  'Stop',
  'PreCompact',
]);

const VALID_WHEN_KEYS = new Set([
  'tool',
  'path',
  'command',
  'prompt',
  'source',
  'agent_type',
  'error',
  'content',
  'response',
]);

const VALID_INJECT_KEYS = new Set(['text', 'hint', 'shell', 'block', 'allow', 'learnings']);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function validateRule(rule) {
  if (!isPlainObject(rule)) return false;
  if (!VALID_EVENTS.has(rule.on)) return false;
  if (!isPlainObject(rule.inject)) return false;

  const injectKeys = Object.keys(rule.inject);
  if (injectKeys.length !== 1) return false;
  const [injectKey] = injectKeys;
  if (!VALID_INJECT_KEYS.has(injectKey)) return false;

  if (rule.when !== undefined && !isPlainObject(rule.when)) return false;
  if (isPlainObject(rule.when)) {
    for (const key of Object.keys(rule.when)) {
      if (!VALID_WHEN_KEYS.has(key)) return false;
      const value = rule.when[key];
      if (key === 'path') {
        if (!isNonEmptyString(value)) return false;
      } else if (!isNonEmptyString(value)) {
        return false;
      }
    }
  }

  if (injectKey === 'allow' && rule.on !== 'PreToolUse') return false;
  if (injectKey === 'block' && !['PreToolUse', 'PostToolUse', 'UserPromptSubmit', 'Stop'].includes(rule.on)) return false;

  if (injectKey === 'shell') {
    if (!isNonEmptyString(rule.inject.shell)) return false;
    if (rule.inject.shell.includes(';') || rule.inject.shell.includes('&&')) return false;
  } else if (injectKey === 'learnings') {
    if (rule.inject.learnings !== true) return false;
  } else if (!isNonEmptyString(rule.inject[injectKey])) {
    return false;
  }

  return true;
}

const validRules = rules.filter(validateRule);

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
  if (when.source) {
    const re = safeRegex(`^(${when.source})$`);
    if (!source || !re || !re.test(source)) return false;
  }
  if (when.agent_type) {
    const re = safeRegex(`^(${when.agent_type})$`);
    if (!agentType || !re || !re.test(agentType)) return false;
  }
  if (when.error) {
    const re = safeRegex(when.error);
    if (!error || !re || !re.test(error)) return false;
  }
  if (when.content) {
    const re = safeRegex(when.content);
    if (!content || !re || !re.test(content)) return false;
  }
  if (when.response) {
    const re = safeRegex(when.response);
    const responseStr = toolResponse != null ? JSON.stringify(toolResponse) : '';
    if (!responseStr || !re || !re.test(responseStr)) return false;
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

const matched = validRules
  .filter((r) => r.on === event && r.inject && matchesWhen(r.when ?? {}))
  .map((r) => resolveInject(r.inject))
  .filter(Boolean);

const canBlock = PERMISSION_EVENTS.has(event) || DECISION_BLOCK_EVENTS.has(event);
const canAllow = PERMISSION_EVENTS.has(event);
const blocks = canBlock ? matched.filter((m) => m.type === 'block') : [];
const allows = canAllow ? matched.filter((m) => m.type === 'allow') : [];
const contexts = matched.filter((m) => m.type === 'context');

// Harness evaluation (best-effort, may return block or context)
const harnessResult = await evaluateHarness({ event, toolName, toolInput, rawPath, prompt });

if (matched.length === 0 && !harnessResult) process.exit(0);

// Merge harness result into blocks/contexts
if (harnessResult) {
  if (harnessResult.type === 'block' && canBlock) {
    blocks.push(harnessResult);
  } else if (harnessResult.type === 'context') {
    contexts.push(harnessResult);
  } else if (harnessResult.type === 'block') {
    // Fallback: if event doesn't support blocking, inject as context
    contexts.push({ type: 'context', value: harnessResult.value });
  }
}

if (blocks.length === 0 && allows.length === 0 && contexts.length === 0) {
  process.exit(0);
}

let additionalContext = contexts.map((m) => m.value).join('\n') || '';
additionalContext = additionalContext || undefined;
const output = buildOutput({ platform, event, blocks, allows, additionalContext });
if (output === null) process.exit(0);
if (typeof output === 'string') process.stdout.write(output);
else process.stdout.write(JSON.stringify(output));
