---
name: ctx-search
description: Understand codebases using ctx tools for token-aware navigation. Use when exploring files, researching topics, onboarding, or preparing to make changes.
argument-hint: "[question, topic, or file path]"
---

# Ctx Search

Navigate docs/code with a strict breadth-first flow and seeded context.

## Tools

Use `npx @anduril-code/ctx` CLI commands.

| Command | Input | Purpose |
|---|---|---|
| `tree [PATH] [--glob PATTERN] [--depth N]` | Repo | Directory tree with per-file token counts |
| `rank <QUERY> [--glob PATTERN] [--maxResults N]` | Code + docs | Rank files by query relevance |
| `gather <QUERY> --maxTokens N [--seeds F,...] [--depth N]` | Code + docs | Auto-discover and assemble context |
| `context <FILES...> --maxTokens N [--strategy S]` | Code + docs | Assemble context from known files |
| `read <FILE> [--maxTokens N] [--strategy S] [--lineHashes]` | Code + docs | Token-budgeted file read (with optional per-line hashes) |
| `outline <FILE> [--depth N]` | Source code | Structural outline with line numbers and **content hashes** |
| `imports <FILE> [--direction incoming\|outgoing]` | Source code | Dependency graph |
| `symbols <QUERY> [--glob PATTERN] [--kind K]` | Source code | Cross-file symbol search |
| `focus <FILE>::<SYMBOL> [--maxTokens N] [--include SECTIONS]` | Source code | One-call symbol context (body, callers, deps, types, tests, conventions) |
| `tokens [FILE]` | Any | Count tokens, bytes, and lines |
| `sections <FILE>` | Markdown | List headings with token costs |
| `extract [--only <heading>] [--strip <heading>] <FILE>` | Markdown | Extract exact section content |
| `locate <QUERY> [FILES...]` | Markdown | Find headings matching a query across files |

All commands are invoked as `npx @anduril-code/ctx <command>`.

## Strategy (high-signal defaults)

1. Build a narrow first-pass context:
   - `gather "<query>" --maxTokens 1200 --seeds <seed files>`
   - If blocked, rerun with `--maxTokens 2200`
2. For file targeting, run `rank` before opening content.
3. For code files, prefer `outline` then `read`.
4. For symbol-level understanding before edits, prefer `focus`.
5. For Markdown, run `sections` first, then `extract --only` exact headings.
6. Use `imports` to trace dependency flow when understanding module relationships.
7. Use `symbols` to find definitions and call sites for specific functions/types.
8. Treat `read` output as triage only; anchor any final claim with line-aware evidence (`outline` or `rg -n` + `sed -n`).

### When given a file path
1. If Markdown: `sections` → `extract --only`/`read`
2. If source code: `outline` → `read`
3. If symbol-specific: `focus <file>::<symbol>`
4. To understand context: `imports` for dependency graph, `symbols` for usage sites

### When given a question or topic
1. `gather "<question>" --maxTokens 1200` for auto-discovery
2. Or manual: `tree` → `rank` → `read` top-ranked files
3. For docs: add `locate` to search across markdown headings
4. For code: add `outline` and `symbols` for structural context

### When onboarding to a codebase
1. `tree` for shape + token map
2. `gather` with default seeds for broad context
3. `outline` entry points and core modules
4. `extract` exact sections from README/AGENTS as needed
5. `imports` on key modules to understand dependency flow

## Hashes and editing

`outline` output includes `hash:xxxx` for every symbol. These hashes are used by the editing tools (`ctx patch`, `ctx insert`, `ctx rename`).

`read --lineHashes` annotates each line with `lineNo:hash| content` — use these 4-char hashes for `ctx patch` line-hash mode or hashline fallback. Line hashes are derived from **line number + line content**, so identical text on different lines gets different hashes. Hashes are valid for the specific content block where they were generated.

When you identify what needs to change, hand off to **ctx-code**.

## Stop conditions

- Stop when you can answer with exact file references.
- Do not full-read large files unless ranked and required.
- Do not finalize recommendations without file + line references.

## Workflow: search → edit → verify

This skill is phase 1 of a 3-phase cycle. **NEVER use raw Edit/Write/MultiEdit tools for source changes.** Always follow this sequence:

1. **Search** (this skill) — investigate, gather context, identify what to change
2. **Edit** — invoke `ctx-code` skill via the Skill tool, then use its patch/insert/rename commands
3. **Verify** — invoke `ctx-verify` skill via the Skill tool to review diffs and run tests

When you know what to change → **STOP and invoke the `ctx-code` skill before touching any file.** Do not call Edit/Write directly.
