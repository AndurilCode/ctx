---
name: rules-to-hook
description: >
  Author and maintain .claude/context-rules.json — the declarative config for the
  context-inject hook. Scans the codebase to propose an initial rule set, then guides
  interactive rule addition. Use with /rules-to-hook.
argument-hint: "[add | list | remove <index>]"
---

# Hook Context Rules

Author and maintain `.claude/context-rules.json` for the `context-inject.mjs` hook.
The engine supports Claude Code and VS Code hook payload formats in Phase 1.

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

Block and allow rules control tool execution (PreToolUse only):

```json
[
  {
    "on": "PreToolUse",
    "when": { "tool": "Bash", "command": "rm -rf" },
    "inject": { "block": "Destructive rm -rf is not allowed." }
  },
  {
    "on": "PreToolUse",
    "when": { "tool": "Read", "path": "docs/**" },
    "inject": { "allow": "Safe: reading documentation." }
  }
]
```

**Precedence:** block > allow > context. If any matched rule is a `block`,
the tool call is denied even if other rules `allow` or inject context.

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
| Key | Behavior | Events |
|---|---|---|
| `text` | Injected verbatim as `additionalContext` | All |
| `hint` | Prefixed with `"Related: "` — agent decides whether to read | All |
| `shell` | Command stdout captured and injected; must be fast (<100 ms); no `;` or `&&` | All |
| `block` | Denies the tool call; value is the reason shown to Claude | PreToolUse only |
| `allow` | Auto-approves the tool call; value is the reason shown to user | PreToolUse only |

## Phase 0 — Bootstrap

Runs **before any other phase**, every time the skill is invoked.

### Detection

Check whether the hook engine is installed:

1. `.claude/hooks/context-inject.mjs` exists
2. `.claude/settings.json` has `context-inject.mjs` registered in all three events
3. `.claude/hooks/node_modules/minimatch` exists (dependency installed)

If **all three** pass → skip to Phase 1.

If **any** is missing → run the installer:

```bash
node skills/rules-to-hook/install.mjs
```

The installer is idempotent. It:
- Creates `.claude/hooks/` and copies the engine from `skills/rules-to-hook/engine.mjs`
- Ensures `package.json` has `minimatch` and installs dependencies
- Merges hook registrations into `.claude/settings.json` (all 3 events, `.*` matcher)
- Seeds an empty `.claude/context-rules.json` if absent

After the installer completes, confirm:
**"Hook engine installed. Proceeding to auto-discovery."**

If the installer fails, stop and report the error — do not continue to later phases.

## Phase 1 — Auto-discovery

Runs by default (and always first, even when invoked with `add`).

Discovery proceeds in five layers dispatched to **subagents** to keep the
main context clean. Only structured summaries flow back.
**Do not propose rules until all layers complete.**

### Dispatch plan

```
Batch 1 (parallel):   Layer 1 · Layer 2 · Layer 3
Batch 2 (parallel):   Layer 3.5 · Layer 4  — both need Layer 3 output
Batch 3 (sequential): Layer 5  — needs Layer 3.5 + Layer 4 output
```

Create a tracked task for each batch (not each layer).

---

### Batch 1 — Gather project data (3 parallel subagents)

Dispatch three `general-purpose` Task subagents **in a single message**.
Each prompt must include the project root path and end with:
**"Return a structured summary only — not raw file contents."**

#### Subagent → Layer 1: Project identity & toolchain

Prompt must instruct the subagent to:

1. Glob `*.md` at project root and read each file — extract purpose,
   guidelines, invariants.
2. Read the package manifest (`package.json`, `pyproject.toml`,
   `Cargo.toml`, or equivalent) — extract scripts, runtime, key deps.
3. Read config files (`biome.json`, `.eslintrc*`, `tsconfig.json`,
   `prettier.config.*`, etc.) — note codified conventions.

**Expected return:**
- Purpose (one sentence)
- Runtime & package manager
- Key dependencies (name → role)
- Codified conventions (list)

#### Subagent → Layer 2: Architecture map

Prompt must instruct the subagent to:

1. Run `npx @anduril-code/ctx tree --depth 3` — identify source, doc,
   config, and test dirs.
2. Glob `src/**/index.{ts,js}` (or language equivalent) — read barrel
   files for module boundaries and public surfaces.
3. Check for `types/`, `interfaces/`, or similar dirs — confirm whether
   pure declarations (no runtime code, no cross-imports).

**Expected return:**
- Directory roles (table: dir → purpose)
- Module boundaries (what each barrel exports)
- Type-only directories (if any)

#### Subagent → Layer 3: Documentation deep-dive

Prompt must instruct the subagent to:

1. Run `npx @anduril-code/ctx rank "architecture constraints invariants style" --maxResults 10`.
   Read every result — do not guess from filenames.
2. Glob `docs/**/*.md` and read all remaining docs. For each doc:
   a. Use `npx @anduril-code/ctx sections <file>` to list headings.
   b. Use `npx @anduril-code/ctx extract <file> --onlySections '<heading>'`
      to read each section individually.
   c. For each section that contains actionable rules or constraints, produce
      a **section record**:
      - `section` — the heading name
      - `file` — source doc path
      - `content` — condensed actionable rules (max 500 chars, drop examples/rationale)
      - `keywords` — 3-5 code-relevant terms (identifiers, directory names,
        patterns) that would appear in files this section governs
3. Skip sections that are purely informational (overview, changelog, credits).

**Expected return:**
- Array of section records (JSON), each with `section`, `file`, `content`, `keywords`

**Wait for all three subagents.** Collect their outputs.

---

### Batch 2 — Path affinity + enforcement audit (2 parallel subagents)

Dispatch two `general-purpose` Task subagents **in a single message**.
**Paste the section records from Layer 3 into both prompts.**

#### Subagent → Layer 3.5: Path affinity via codebase grep

Prompt must instruct the subagent to:

1. For each section record, Grep the codebase for each keyword.
2. For each keyword hit, note which top-level source directory contains it
   (e.g. `src/api`, `src/components`, `tests`).
3. Rank directories by **hit density**: hits for this section's keywords
   divided by total files in the directory.
4. Assign the top 1-3 directories as path globs (e.g. `src/api/**`).
5. If a section's keywords match across 5+ top-level directories with no
   clear winner (no directory has >30% of hits), assign `src/**` and flag
   as `broad: true`.
6. If a section's keywords produce zero hits, flag as `noMatch: true`.

**Expected return:**
- Enriched section records: original fields plus `paths` (string array of
  globs) and optional `broad` / `noMatch` flags

#### Subagent → Layer 4: Enforcement audit

Prompt must instruct the subagent to:

1. Read every file in `.claude/hooks/` — source code, not just filenames.
   Understand what each hook enforces (blocks, rewrites, denies, injects).
2. Read `.claude/context-rules.json` if it exists — list every rule.
3. Cross-reference each section record from Layer 3 against existing
   hooks and rules. Mark each as:
   - **Enforced** — already covered → skip
   - **Unenforced** — no coverage → candidate
   - **Partial** — partially covered → may need complementary rule

**Expected return:**
- Existing hooks summary (what each enforces)
- Existing rules list
- Section status table (section → Enforced / Unenforced / Partial)

**Wait for both subagents.** Collect their outputs.

---

### Batch 3 — Verify & derive candidates (1 subagent)

Dispatch one `general-purpose` Task subagent.
**Paste the enriched section records from Layer 3.5 and the section status
table from Layer 4 into the prompt.**

#### Subagent → Layer 5: Verification & per-section rule generation

Prompt must instruct the subagent to:

1. Filter to unenforced / partial sections only (from Layer 4 status).
2. For every section that asserts a codebase property (e.g. "types/ is
   pure", "no imports from cli/"), use Grep to confirm it actually holds.
   Drop any section whose assertions do not hold.
3. For each verified section, emit one rule **per path** in its `paths`
   array:
   ```json
   {
     "on": "PreToolUse",
     "when": { "tool": "Write|Edit|MultiEdit", "path": "<glob>" },
     "inject": { "text": "<Section Name>: <condensed content>" }
   }
   ```
   - Prefix `text` with the section name for self-describing context.
   - Cap `text` at 500 characters. If longer, condense to actionable
     rules only (drop examples and rationale).
4. **Deduplication**: if two sections produce rules with the same path
   and overlapping content, merge them into one rule with combined text
   (separated by newline).
5. For sections flagged `noMatch: true`, include the candidate but
   annotate with `(no matching code found)` — the user will assign a
   path or skip.
6. For sections flagged `broad: true`, include the candidate but
   annotate with `(broad — keywords matched everywhere)`.
7. Format each candidate as a JSON rule object.

**Expected return:**
- Verified sections (with Grep evidence)
- Candidate rules (JSON array, each annotated with source section,
  file, path, and any flags)

**Wait for completion.**

---

### Presentation

Use the Layer 5 output to present a numbered table of candidate rules.
Each row must include:
- **Scope** — the path glob this rule targets
- The rule (compact JSON or summary)
- **Source** — which doc/file and section established the constraint
- **Verification** — what Grep/check confirmed it
- **Flags** — `broad` or `no match` if applicable

```
#  on          scope              inject                          source
───────────────────────────────────────────────────────────────────────────
0  PreToolUse  src/api/**         text: "API Design: Use camel…"  docs/style.md §API Design
1  PreToolUse  src/components/**  text: "Components: Functional…" docs/style.md §Components
2  PreToolUse  **/*.test.*        text: "Test Patterns: descri…"  docs/style.md §Test Patterns
3  PreToolUse  src/**  (broad)    text: "Naming: Use snake_cas…"  docs/style.md §Naming
```

Ask: **"Accept all (a), pick by number (e.g. 1,3), or skip (s)?"**

For rules flagged `(no match)`, prompt: **"No matching code found for
'<section>'. Assign a path glob or skip? (glob / s)"**

Write accepted rules to `.claude/context-rules.json` (create if absent,
merge if exists).

## Phase 2 — User Additions

After auto-discovery (or when invoked with `add`), ask: **"Anything else to add? (y/n)"**

If yes, collect one answer at a time:

1. **Event** — PreToolUse / PostToolUse / UserPromptSubmit
2. **Trigger keys** — show only valid keys for the chosen event:
   - PreToolUse / PostToolUse: `tool`, `path`, `command`
   - UserPromptSubmit: `prompt`
3. **Inject type** — text / hint / shell / block / allow
   - For `block` or `allow`: only available when event is PreToolUse
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
- `block` and `allow` keys are only valid on `PreToolUse` rules — reject on other events with: `"block/allow rules only work on PreToolUse events."`

## Notes

- Prefer `hint` over `text` for long or optional context — it costs fewer tokens.
- `shell` output is injected verbatim; keep commands deterministic and side-effect-free.
- The hook fires on every matching tool call — keep `when` filters targeted.
- Phase 0 may create `context-inject.mjs` and modify `settings.json` — only during initial bootstrap.
