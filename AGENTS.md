---
scoped_rules:
  - id: stages-ast-only
    scope: "src/stages/**"
    severity: error
  - id: core-wiring-only
    scope: "src/core/compact.ts"
    severity: error
  - id: cli-mcp-no-logic
    scope: "src/{cli,mcp}/**"
    severity: error
  - id: no-reverse-imports
    scope: "src/{core,stages,parser,types}/**"
    severity: error
danger_zones:
  - path: "src/stages/**"
    invariant: "AST nodes only; string ops belong in src/utils/text.ts"
  - path: "src/core/compact.ts"
    invariant: "Wiring only; no business logic"
  - path: "src/core/expand.ts"
    invariant: "Wiring only; no business logic"
---

# AGENTS.md

## @Context

Token-efficient Markdown compression library. The primary invariant is **lossless round-trip**: `expand(compact(md)) === md` for all inputs, always. When choosing between implementation approaches, prefer the one that makes round-trip easier to guarantee over one that achieves higher compression.

## @Stack

- **Linter/formatter**: biome (not eslint + prettier — do not add those).
- **Package manager**: bun (not npm, pnpm, or yarn).

## @Knowledge Graph

<!-- No entries needed -->

## @Map

- `src/stages/` — Stages **must** operate on AST nodes only. NEVER manipulate raw strings here; string ops belong in `src/utils/text.ts`.
- `src/core/compact.ts` / `expand.ts` — Wiring only. NEVER add business logic; it belongs in stages or parser.
- Dependency flow is strictly one-way: `types/ → utils/ → stages/ & parser/ → core/ → cli/ & mcp/`. Reverse imports cause silent circular dependency failures at runtime.

## @Workflow

- `bun run build` — compiles ESM + CJS via bun build + types via tsc
- `bun run lint` — biome check (lint + format check); pre-existing violations in repo
- `bun run typecheck` — tsc --noEmit
- `bun test` — bun test runner

## @HighSignal

Default to `compact_md_*` tools before raw file reads. Keep first-pass context small, then expand only where blocked.

### Seed set (use first in `compact_md_gather` / `compact_md_context`)

- `AGENTS.md`
- `src/core/compact.ts`
- `src/core/expand.ts`
- `src/stages/**`
- `src/parser/**`
- `src/types/**`
- `src/utils/text.ts`
- `tests/**`

### Default chains

- Explore/topic: `tree -> rank -> gather -> read/extract`
- Implement change: `gather (seeded, small budget) -> edit -> outline`
- Review: `changes/diff -> outline -> review`
- Test/debug: run tests -> `prune_log(profile=test)` -> outline failing files
- Docs: `sections -> summarize -> extract`

### Budget policy

- Start with `maxTokens: 1200` for gather/context
- Raise to `2200` only if blocked
- Use `extract` for exact wording; use `summarize` for gist only
- Scope first: derive candidate files from `git diff` (or explicit target paths) before `gather` to prevent context drift

### Evidence policy

- Use `compact_md_read` for triage only
- For claims/findings, require line-anchored evidence via `compact_md_code_outline` or `rg -n` + `sed -n`
- Prefer `rg -F` for literal snippets (especially escaped text like `\\n`); use `-U/--multiline` only for true multiline regex
- No recommendation without file path and line reference

## @Rules

- NEVER let any file exceed 200 lines — split it.
- NEVER add business logic to `src/cli/` or `src/mcp/` — they are thin adapters over `core/`.
- ALWAYS keep `core/` free of runtime dependencies — it must stay zero-dep.
- NEVER import from `cli/` or `mcp/` inside `core/`, `stages/`, `parser/`, or `types/`.
- PITFALL: Claude Code PostToolUse hook `additionalContext` at top level is silently ignored → FIX: wrap in `hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: '...' }`.

## @Skills

Three agent skills in `.claude/skills/` expose compact.md workflows as slash commands. Each skill references `compact_md_*` MCP tools with CLI fallbacks via `npx @anduril-code/compact.md`.

| Skill | Slash command | When to use | Key tools |
|---|---|---|---|
| `compact-review` | `/compact-review [branch\|range]` | Code review — compress diffs, outline changed files, surface risks | `diff`, `code-outline` |
| `compact-test` | `/compact-test [cmd\|file]` | Test runs — prune noisy output, highlight failures with structural context | `prune-log`, `code-outline` |
| `compact-explore` | `/compact-explore [question\|path]` | Codebase navigation — token-aware reading, onboarding, topic search | `sections`, `extract`, `code-outline`, `gather` |

## @Memory

```
When you encounter a failure that took >3 attempts to resolve, append it to @Rules:
  - PITFALL: [what went wrong] → FIX: [what works]

When you discover a required command not in @Workflow, test it first, then add it if it passes.

When a @Workflow command stops working, mark it and add the fix or remove it.

Periodically remove @Memory entries that are now enforced by CI or tooling.
```
