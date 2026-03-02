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

// 2. Copy engine
if (!existsSync(ENGINE_DST)) {
  copyFileSync(ENGINE_SRC, ENGINE_DST);
  log('Copied engine → .claude/hooks/context-inject.mjs');
} else {
  skip('.claude/hooks/context-inject.mjs');
}

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

console.log('\nDone. The context-inject hook engine is ready.\n');
