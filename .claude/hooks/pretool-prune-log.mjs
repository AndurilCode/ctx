#!/usr/bin/env node
// PreToolUse hook: route noisy command output through compact.md prune.

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

if (!isPruneCandidate(originalCommand)) {
  process.exit(0);
}

const profile = detectProfile(originalCommand);
const rewritten = `set -o pipefail; (${originalCommand}) 2>&1 | npx @anduril-code/compact.md prune --profile ${profile}`;
const updatedContainer = { ...container, [key]: rewritten };

const result = {
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    updatedInput: updatedContainer,
    additionalContext: `[compact.md] Rewrote Bash command for log pruning (${profile}):\n${rewritten}`,
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

function isPruneCandidate(command) {
  const normalized = command.replace(/\s+/g, ' ').trim();
  if (!normalized) return false;

  if (/compact\.md\s+prune/.test(normalized) || /compact\.md\s+changes/.test(normalized))
    return false;
  if (/^git (diff|show)\b/.test(normalized)) return false;

  // Keep this conservative: skip commands where output piping could alter semantics.
  // Allow 2>&1 (stderr-to-stdout) since it doesn't redirect to files.
  const withoutStderrRedirect = normalized.replace(/\b2>&1\b/g, '');
  if (/[<>]/.test(withoutStderrRedirect) || /\|/.test(withoutStderrRedirect)) return false;
  if (/\btee\b/.test(normalized)) return false;

  return isNoisyCommand(normalized);
}

function isNoisyCommand(command) {
  return (
    lintPattern().test(command) ||
    testPattern().test(command) ||
    ciPattern().test(command) ||
    runtimePattern().test(command)
  );
}

function detectProfile(command) {
  if (lintPattern().test(command)) return 'lint';
  if (testPattern().test(command)) return 'test';
  if (ciPattern().test(command)) return 'ci';
  return 'runtime';
}

function lintPattern() {
  return /\b(biome|eslint|stylelint|ruff|flake8|pylint|shellcheck|golangci-lint|swiftlint|ktlint)\b|\b(?:bun|npm|pnpm|yarn)\s+run\s+lint\b/;
}

function testPattern() {
  return /\b(pytest|jest|vitest|mocha|ava|tap|bun\s+test|npm\s+test|pnpm\s+test|yarn\s+test|go\s+test|cargo\s+test|mvn\s+test|gradle\s+test)\b/;
}

function ciPattern() {
  return /\b(?:bun|npm|pnpm|yarn)\s+run\s+(?:build|check|typecheck)\b|\b(tsc\b|mypy\b|cargo\s+check\b|go\s+vet\b)/;
}

function runtimePattern() {
  return /\b(docker\s+compose\s+logs|docker\s+logs|kubectl\s+logs|journalctl|tail\s+-f|pm2\s+logs)\b/;
}
