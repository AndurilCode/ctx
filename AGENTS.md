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

- ✅ `bun run build` — compiles ESM + CJS via bun build + types via tsc
- ⚠️ `bun run lint` — biome check (lint + format check); pre-existing violations in repo
- ✅ `bun run typecheck` — tsc --noEmit
- ✅ `bun test` — bun test runner

## @Rules

- NEVER let any file exceed 200 lines — split it.
- NEVER add business logic to `src/cli/` or `src/mcp/` — they are thin adapters over `core/`.
- ALWAYS keep `core/` free of runtime dependencies — it must stay zero-dep.
- NEVER import from `cli/` or `mcp/` inside `core/`, `stages/`, `parser/`, or `types/`.

## @Memory

```
When you encounter a failure that took >3 attempts to resolve, append it to @Rules:
  - PITFALL: [what went wrong] → FIX: [what works]

When you discover a required command not in @Workflow, test it first, then add it if it passes.

When a @Workflow command stops working, mark it and add the fix or remove it.

Periodically remove @Memory entries that are now enforced by CI or tooling.
```
