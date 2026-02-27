---
name: hook-context-rules
description: >
  Author and maintain .claude/context-rules.json — the declarative config for the
  context-inject hook. Scans the codebase to propose an initial rule set, then guides
  interactive rule addition. Use with /hook-context-rules.
argument-hint: "[add | list | remove <index>]"
---

# Hook Context Rules

Author and maintain `.claude/context-rules.json` for the `context-inject.mjs` hook.

## Config Format

Rules are a JSON array. Each rule has an `on` event, a `when` filter (all keys optional,
implicit AND), and an `inject` payload (exactly one key).

```json
[
  {
    "on": "PreToolUse",
    "when": {
      "tool": "Edit|Write",
      "path": "src/core/**"
    },
    "inject": {
      "text": "core/ is wiring only — no business logic here."
    }
  },
  {
    "on": "PostToolUse",
    "when": { "tool": "Read", "path": "src/stages/**" },
    "inject": { "hint": "docs/stages-overview.md" }
  },
  {
    "on": "UserPromptSubmit",
    "when": { "prompt": "test|spec" },
    "inject": { "shell": "bun test --listTests 2>/dev/null | head -20" }
  }
]
```

### `on` values
`PreToolUse` / `PostToolUse` / `UserPromptSubmit`

### `when` keys (all optional, implicit AND)
| Key | Type | Notes |
|---|---|---|
| `tool` | string | Pipe-separated alternatives: `"Edit\|Write"` |
| `path` | glob | Matched against file_path / path in tool input |
| `command` | regex | Bash tool only — matched against command string |
| `prompt` | regex | `UserPromptSubmit` only |

### `inject` keys (exactly one)
| Key | Behavior |
|---|---|
| `text` | Injected verbatim as `additionalContext` |
| `hint` | Prefixed with `"Related: "` — agent decides whether to read |
| `shell` | Command stdout captured and injected; must be fast (<100 ms); no `;` or `&&` |

## Phase 1 — Auto-discovery

Runs by default (and always first, even when invoked with `add`).

1. **Understand the project layout** — read `README.md`, `CLAUDE.md`, `AGENTS.md`, or any top-level doc file that exists. Extract architecture constraints, module boundaries, invariants, and conventions (whatever format the project uses).
2. **Map the source tree** — run `npx @anduril-code/ctx tree --depth 2` to see directory structure and identify key source dirs, doc dirs, and config dirs.
3. **Find key docs** — run `npx @anduril-code/ctx rank "architecture constraints" --maxResults 5` to surface high-signal documentation.
4. **List existing hooks** — read `.claude/hooks/` to understand what is already covered and avoid duplicating it.
5. **Derive candidate rules** by looking for these generic signals:
   - Directories described as having specific constraints (e.g. "no side effects here", "read-only", "thin adapter") → `PreToolUse` text rules on matching paths
   - Doc files that are clearly about specific source dirs (e.g. `docs/parser.md` next to `src/parser/`) → `PostToolUse` hint rules triggered when those source files are read
   - Core invariants mentioned in docs (test contracts, data format guarantees, encoding rules) → `UserPromptSubmit` rules matching relevant keywords
   - Stack/toolchain constraints (which package manager, linter, formatter, test runner) → `UserPromptSubmit` rules matching alternative tool names
6. Present a numbered list with one-line rationale per candidate rule.
7. Ask: **"Accept all (a), pick by number (e.g. 1,3), or skip (s)?"**
8. Write accepted rules to `.claude/context-rules.json` (create if absent, merge if exists).

## Phase 2 — User Additions

After auto-discovery (or when invoked with `add`), ask: **"Anything else to add? (y/n)"**

If yes, collect one answer at a time:

1. **Event** — PreToolUse / PostToolUse / UserPromptSubmit
2. **Trigger keys** — show only valid keys for the chosen event:
   - PreToolUse / PostToolUse: `tool`, `path`, `command`
   - UserPromptSubmit: `prompt`
3. **Inject type** — text / hint / shell
4. **Inject content**:
   - For `hint`: list existing `.md` files nearby and suggest one
   - For `shell`: remind that the command must be fast and use no `;` or `&&`
5. Preview the JSON rule and ask: **"Add this rule? (y/n)"**
6. On confirm, append to `.claude/context-rules.json`.

Repeat until user says no.

## Phase 3 — List

When invoked with `list`, display current rules as an ASCII table:

```
#  on               when                          inject
─────────────────────────────────────────────────────────────────
0  PreToolUse       tool=Edit|Write path=src/**   text: "..."
1  PostToolUse      tool=Read path=src/stages/**  hint: docs/...
2  UserPromptSubmit prompt=test                   shell: bun ...
```

If `.claude/context-rules.json` does not exist, print: `No rules found.`

## Phase 4 — Remove

When invoked with `remove <index>`:

1. Show the full rule at that index.
2. Ask: **"Remove this rule? (y/n)"**
3. On confirm, remove the entry and rewrite the file.

If the index is out of range, print: `Index <n> is out of range (0–<max>).`

## Validation

Apply before writing any rule:

- `when` must have at least one key — reject rules with an empty `when` object.
- `path` globs must be non-empty strings.
- `hint` values should exist on disk — warn if the file is not found, but do not block.
- `shell` values must not contain `;` or `&&` — reject with an explanation.
- `inject` must have exactly one key — reject if zero or more than one key is present.

## Notes

- Prefer `hint` over `text` for long or optional context — it costs fewer tokens.
- `shell` output is injected verbatim; keep commands deterministic and side-effect-free.
- The hook fires on every matching tool call — keep `when` filters targeted.
- This skill never modifies `context-inject.mjs` or `settings.json`.
