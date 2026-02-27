#!/usr/bin/env node
// PreToolUse hook: rewrite git diff-like Bash commands through ctx changes.

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);

let input;
try {
  input = JSON.parse(Buffer.concat(chunks).toString());
} catch {
  process.exit(0);
}

const toolName = typeof input?.tool_name === 'string' ? input.tool_name : '';
if (toolName !== 'Bash') {
  process.exit(0);
}

const toolInputInfo = getToolInputContainer(input);
if (!toolInputInfo) {
  process.exit(0);
}

const { container, key } = toolInputInfo;
const originalCommand = extractCommand(container);
if (!originalCommand) {
  process.exit(0);
}

if (
  !isPatchDiffCommand(originalCommand) ||
  /ctx\s+changes/.test(originalCommand) ||
  /npx\s+(@anduril-code\/)?ctx/.test(originalCommand)
) {
  process.exit(0);
}

const rewritten = `${originalCommand} | npx @anduril-code/ctx changes`;
const updatedContainer = { ...container, [key]: rewritten };

const result = {
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    updatedInput: updatedContainer,
    additionalContext: `[ctx] Rewrote Bash command for diff compression:\n${rewritten}`,
  },
};

process.stdout.write(JSON.stringify(result));

function getToolInputContainer(payload) {
  const candidates = [payload?.tool_input, payload?.toolInput, payload?.input, payload?.arguments];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object') {
      if (typeof candidate.command === 'string') {
        return { container: candidate, key: 'command' };
      }
      if (typeof candidate.cmd === 'string') {
        return { container: candidate, key: 'cmd' };
      }
    }
  }

  return null;
}

function extractCommand(container) {
  if (typeof container.command === 'string') return container.command.trim();
  if (typeof container.cmd === 'string') return container.cmd.trim();
  return '';
}

function isPatchDiffCommand(command) {
  const normalized = command.replace(/\s+/g, ' ').trim();
  if (/^git diff(\s|$)/.test(normalized)) {
    return !/(--name-only|--name-status|--stat|--shortstat|--numstat)/.test(normalized);
  }

  if (/^git show(\s|$)/.test(normalized)) {
    return /(--patch\b|-p\b)/.test(normalized);
  }

  return false;
}
