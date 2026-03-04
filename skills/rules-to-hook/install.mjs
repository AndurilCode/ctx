#!/usr/bin/env node
// Idempotent installer for the context-inject hook engine.
// Run from project root: node skills/rules-to-hook/install.mjs
//
// What it does:
//   1. Creates .claude/hooks/ directory
//   2. Copies engine.mjs → .claude/hooks/context-inject.mjs
//   3. Ensures package.json has the minimatch dependency
//   4. Installs dependencies (bun or npm)
//   5. Registers the hook in .claude/settings.json (all 3 events)
//   6. Seeds an empty .claude/context-rules.json if absent

import { mkdirSync, readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const HOOKS_DIR = resolve(ROOT, '.claude/hooks');
const ENGINE_DST = resolve(HOOKS_DIR, 'context-inject.mjs');
const ENGINE_SRC = new URL('./engine.mjs', import.meta.url).pathname;
const LEARN_DST = resolve(HOOKS_DIR, 'learn.mjs');
const LEARN_SRC = new URL('./learn.mjs', import.meta.url).pathname;
const PLATFORM_DST = resolve(HOOKS_DIR, 'platform.mjs');
const PLATFORM_SRC = new URL('./platform.mjs', import.meta.url).pathname;
const LEARNINGS_PATH = resolve(ROOT, '.claude/learnings.json');
const PKG_PATH = resolve(HOOKS_DIR, 'package.json');
const SETTINGS_PATH = resolve(ROOT, '.claude/settings.json');
const RULES_PATH = resolve(ROOT, '.claude/context-rules.json');

const EVENTS = ['PreToolUse', 'PostToolUse', 'UserPromptSubmit'];
const HOOK_ENTRY = {
  type: 'command',
  command: 'node .claude/hooks/context-inject.mjs',
  cwd: '.',
  statusMessage: 'Injecting context rules…',
};

// ── helpers ──────────────────────────────────────────────────────────

function readJSON(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch { return null; }
}

function writeJSON(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

function log(msg)  { console.log(`  ✓ ${msg}`); }
function skip(msg) { console.log(`  · ${msg} (already exists)`); }

function hasContextInject(hookArray) {
  return Array.isArray(hookArray) &&
    hookArray.some((g) => g.hooks?.some((h) => h.command?.includes('context-inject.mjs')));
}

function detectInstaller() {
  try { execSync('bun --version', { stdio: 'ignore' }); return 'bun install'; }
  catch { return 'npm install'; }
}

// ── main ─────────────────────────────────────────────────────────────

console.log('\nInstalling context-inject hook engine…\n');

// 1. Directory
mkdirSync(HOOKS_DIR, { recursive: true });

// 2. Copy engine (always — ensures deployed copy stays in sync)
copyFileSync(ENGINE_SRC, ENGINE_DST);
log('Synced engine → .claude/hooks/context-inject.mjs');

// 2b. Copy platform module
copyFileSync(PLATFORM_SRC, PLATFORM_DST);
log('Synced platform module → .claude/hooks/platform.mjs');

// 2c. Copy learn CLI
copyFileSync(LEARN_SRC, LEARN_DST);
log('Synced learn CLI → .claude/hooks/learn.mjs');

// 3. package.json
const pkg = readJSON(PKG_PATH);
if (!pkg) {
  writeJSON(PKG_PATH, {
    name: '@local/claude-hooks', version: '0.0.1',
    private: true, type: 'module',
    dependencies: { minimatch: '^10.0.0' },
  });
  log('Created .claude/hooks/package.json');
} else if (!pkg.dependencies?.minimatch) {
  pkg.dependencies = { ...pkg.dependencies, minimatch: '^10.0.0' };
  writeJSON(PKG_PATH, pkg);
  log('Added minimatch to .claude/hooks/package.json');
} else {
  skip('.claude/hooks/package.json');
}

// 4. Install deps
const cmd = detectInstaller();
console.log(`  … Running ${cmd} in .claude/hooks/`);
execSync(cmd, { cwd: HOOKS_DIR, stdio: 'inherit' });
log('Dependencies installed');

// 5. Register in settings.json
const settings = readJSON(SETTINGS_PATH) || {};
settings.hooks = settings.hooks || {};
let changed = false;
for (const ev of EVENTS) {
  settings.hooks[ev] = settings.hooks[ev] || [];
  if (!hasContextInject(settings.hooks[ev])) {
    settings.hooks[ev].push({ matcher: '.*', hooks: [HOOK_ENTRY] });
    changed = true;
  }
}
if (changed) {
  writeJSON(SETTINGS_PATH, settings);
  log('Registered in .claude/settings.json');
} else {
  skip('.claude/settings.json');
}

// 6. Seed rules
if (!existsSync(RULES_PATH)) {
  writeJSON(RULES_PATH, []);
  log('Created empty .claude/context-rules.json');
} else {
  skip('.claude/context-rules.json');
}

// 7. Seed learnings store
if (!existsSync(LEARNINGS_PATH)) {
  writeJSON(LEARNINGS_PATH, []);
  log('Created empty .claude/learnings.json');
} else {
  skip('.claude/learnings.json');
}

// 8. Seed learnings context rules
const rulesData = readJSON(RULES_PATH) || [];
const LEARNINGS_RULES = [
  {
    on: 'PostToolUse',
    when: { tool: 'Read|read_file', path: '**' },
    inject: { learnings: true },
  },
  {
    on: 'UserPromptSubmit',
    inject: {
      text: 'Learnings system: if you discover something non-obvious about a file (architecture constraints, pitfalls, patterns), record it with: node .claude/hooks/learn.mjs add --files \'<glob>\' --learning \'<text>\'. Only record genuinely useful insights. Use list/update/remove to curate existing learnings.',
    },
  },
];

let rulesChanged = false;
for (const rule of LEARNINGS_RULES) {
  const exists = rulesData.some(
    (r) => JSON.stringify(r.inject) === JSON.stringify(rule.inject) && r.on === rule.on,
  );
  if (!exists) {
    rulesData.push(rule);
    rulesChanged = true;
  }
}
if (rulesChanged) {
  writeJSON(RULES_PATH, rulesData);
  log('Added learnings rules to .claude/context-rules.json');
} else {
  skip('learnings rules in .claude/context-rules.json');
}

console.log('\nDone. The context-inject hook engine is ready.\n');
