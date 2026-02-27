# Rebrand: compact.md → ctx

**Date**: 2026-02-27
**Status**: Approved

## Motivation

Rebrand the project from `compact.md` to `ctx` — a shorter, more intuitive name that communicates the tool's core value: building context for agent pipelines. Aligns with the short-command aesthetic (uv, npm, bun).

## Naming

| Surface | Before | After |
|---|---|---|
| npm package | `@anduril-code/compact.md` | `@anduril-code/ctx` |
| CLI binary | `compact.md` | `ctx` |
| MCP server binary | `compact-md-mcp` | `ctx-mcp` |
| MCP tool prefix | `compact_md_*` (21 tools) | `ctx_*` |
| MCP server name | `compact-md` | `ctx` |

## Scope

~208 occurrences across 56 files.

### Source code

- `src/mcp/tools/*.ts` — tool name strings `compact_md_*` → `ctx_*`
- `src/mcp/server.ts` — server name
- `src/cli/index.ts` — program name
- `src/cli/commands/*.ts` — help text references
- `src/utils/*-cache.ts` — cache directory names referencing brand

### Config and meta

- `package.json` — name, bin entries
- `CLAUDE.md` / `AGENTS.md` — documentation references
- `.claude/skills/*.md` — skill docs referencing CLI and MCP names
- `.claude/settings.json` — MCP server config
- `.claude/hooks/*.mjs` — hook scripts

### Tests

- `tests/**/*.test.ts` — references to tool names, CLI commands

### Docs

- `README.md` — all references

## What does NOT change

- Internal module names (`compact.ts`, `expand.ts`) — these describe the operation, not the brand
- The `compact()` / `expand()` API functions — verbs, not brand
- `src/parser/constants.ts` — format markers (format-related, not brand)
- Core architecture and dependency flow

## Migration strategy

Three distinct find-and-replace patterns, applied in order:

1. `compact_md_` → `ctx_` (MCP tool prefix)
2. `compact.md` → `ctx` (CLI name, package name, prose)
3. `compact-md` → `ctx` (bin name, kebab-case references)

Each applied with care — the `compact()` function and format references stay untouched.
