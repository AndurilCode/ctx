#!/usr/bin/env node
// Hook engine: inject additionalContext based on .claude/context-rules.json

import { existsSync, readFileSync } from 'node:fs';
import { minimatch } from 'minimatch';
import { extractInput, pickString, buildOutput, PERMISSION_EVENTS, DECISION_BLOCK_EVENTS } from './platform.mjs';
import { evaluateHarness } from './harness-eval.mjs';
import { runHealthCheck } from './health-check.mjs';
// CLI --check mode (no stdin needed)
if (process.argv.includes('--check')) {
  const result = runHealthCheck(process.cwd());
  if (result.issues.length === 0) {
    console.log('All checks passed.');
  } else {
    for (const issue of result.issues) {
      console.log(`[${issue.level.toUpperCase()}] ${issue.message}`);
    }
  }
  process.exit(result.ok ? 0 : 1);
}

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);














let input;
try {
  input = JSON.parse(Buffer.concat(chunks).toString());
} catch (e) {
  console.error(`[context-inject] Failed to parse stdin: ${e.message}`);
  process.exit(0);
}

// VS Code doesn't include event name in payload; accept it as CLI argument
const cliEvent = process.argv[2] || '';
const { platform, event, toolName, toolInput, prompt, source, agentType, error, toolResponse, content, stopHookActive } = extractInput(input, cliEvent);

// Stop safety guard: if stop_hook_active is set, exit silently to prevent infinite loops
if (event === 'Stop' && stopHookActive) process.exit(0);

// SessionStart health check
if (event === 'SessionStart') {
  const hc = runHealthCheck(process.cwd());
  if (hc.issues.length > 0) {
    const errors = hc.issues.filter(i => i.level === 'error');
    const warns = hc.issues.filter(i => i.level === 'warn');
    const parts = [];
    if (errors.length) parts.push(`${errors.length} error(s)`);
    if (warns.length) parts.push(`${warns.length} warning(s)`);
    console.error(`[context-inject] Health check: ${parts.join(', ')}. Run: node .claude/hooks/context-inject.mjs --check`);
  }
}

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
} catch (e) {
  console.error(`[context-inject] Failed to parse context-rules.json: ${e.message}`);
  process.exit(0);
}
if (!Array.isArray(rules)) {
  console.error('[context-inject] context-rules.json must be a JSON array');
  process.exit(0);
}

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
    console.error('[context-inject] inject.shell is not supported — use a dedicated hook script');
    return null;
  }
  return null;
}

const matched = rules
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
