// .claude/hooks/health-check.mjs
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const VALID_EVENTS = new Set([
  'PreToolUse',
  'PostToolUse',
  'UserPromptSubmit',
  'SessionStart',
  'SessionEnd',
  'SubagentStart',
  'PostToolUseFailure',
  'Stop',
  'PreCompact',
  'ErrorOccurred',
]);

const VALID_INJECT_KEYS = new Set(['text', 'hint', 'learnings', 'block', 'allow']);

const WHEN_REGEX_FIELDS = new Set([
  'tool', 'command', 'prompt', 'source', 'agent_type', 'error', 'content', 'response',
]);

/**
 * Run a health check on the context-rules configuration.
 * @param {string} cwd - working directory containing .claude/context-rules.json
 * @returns {{ ok: boolean, issues: Array<{ level: 'warn'|'error', message: string }> }}
 */
export function runHealthCheck(cwd) {
  const issues = [];
  const configPath = join(cwd, '.claude', 'context-rules.json');

  // 1. Check config exists
  if (!existsSync(configPath)) {
    return { ok: true, issues: [{ level: 'warn', message: 'No context-rules.json found' }] };
  }

  // 2. Parse JSON
  let rules;
  try {
    rules = JSON.parse(readFileSync(configPath, 'utf8'));
  } catch (e) {
    issues.push({ level: 'error', message: `Failed to parse context-rules.json: ${e.message}` });
    return { ok: false, issues };
  }

  // 3. Must be an array
  if (!Array.isArray(rules)) {
    issues.push({ level: 'error', message: 'context-rules.json must be an array' });
    return { ok: false, issues };
  }

  // 4. Validate each rule
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    const prefix = `Rule ${i}`;

    // Validate event name
    if (!VALID_EVENTS.has(rule.on)) {
      issues.push({ level: 'error', message: `${prefix}: unknown event "${rule.on}"` });
    }

    // Validate inject exists
    if (!rule.inject || typeof rule.inject !== 'object') {
      issues.push({ level: 'error', message: `${prefix}: missing or invalid inject clause` });
      continue; // skip further inject checks
    }

    // Check for removed shell key
    if ('shell' in rule.inject) {
      issues.push({ level: 'error', message: `${prefix}: inject.shell is removed — use a different inject method` });
    }

    // Check for unknown inject keys
    for (const key of Object.keys(rule.inject)) {
      if (!VALID_INJECT_KEYS.has(key) && key !== 'shell') {
        issues.push({ level: 'error', message: `${prefix}: unknown inject key "${key}"` });
      }
    }

    // Validate regex fields in when clause
    if (rule.when && typeof rule.when === 'object') {
      for (const [field, pattern] of Object.entries(rule.when)) {
        if (WHEN_REGEX_FIELDS.has(field) && typeof pattern === 'string') {
          try {
            new RegExp(pattern);
          } catch (e) {
            issues.push({ level: 'error', message: `${prefix}: invalid regex in when.${field}: ${e.message}` });
          }
        }
      }
    }
  }

  // 5. Check harness dist
  const distPath = join(cwd, 'dist', 'index.js');
  if (!existsSync(distPath)) {
    issues.push({ level: 'warn', message: 'Harness dist not found at dist/index.js' });
  }

  const hasErrors = issues.some(i => i.level === 'error');
  return { ok: !hasErrors, issues };
}
