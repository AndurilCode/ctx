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
node skills/hook-context-rules/install.mjs
```

The installer is idempotent. It:
- Creates `.claude/hooks/` and copies the engine from `skills/hook-context-rules/engine.mjs`
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

1. Run `npx @anduril-code/ctx rank "architecture constraints invariants" --maxResults 10`.
   Read every result — do not guess from filenames.
2. Glob `docs/**/*.md` and read all remaining docs (token-budget per file
   if needed). For each doc extract:
   - Module boundary / responsibility constraints
   - Dependency flow rules
   - Data invariants (round-trip, encoding, schema)
   - Naming, style, or toolchain conventions
3. Build a **constraint inventory** — numbered list:
   `N. <constraint description> — source: <file>`

**Expected return:**
- Constraint inventory (the numbered list with source attribution)

**Wait for all three subagents.** Collect their outputs.

---

### Batch 2 — Audit enforcement (1 subagent)

Dispatch one `general-purpose` Task subagent.
**Paste the constraint inventory from Layer 3 into the prompt.**

#### Subagent → Layer 4: Enforcement audit

Prompt must instruct the subagent to:

1. Read every file in `.claude/hooks/` — source code, not just filenames.
   Understand what each hook enforces (blocks, rewrites, denies, injects).
2. Read `.claude/context-rules.json` if it exists — list every rule.
3. Cross-reference each constraint from the inventory against existing
   hooks and rules. Mark each as:
   - **Enforced** — already covered → skip
   - **Unenforced** — no coverage → candidate
   - **Partial** — partially covered → may need complementary rule

**Expected return:**
- Existing hooks summary (what each enforces)
- Existing rules list
- Constraint status table (constraint → Enforced / Unenforced / Partial)

**Wait for completion.**

---

### Batch 3 — Verify & derive candidates (1 subagent)

Dispatch one `general-purpose` Task subagent.
**Paste the unenforced / partial constraints from Layer 4 into the prompt.**

#### Subagent → Layer 5: Verification & candidate derivation

Prompt must instruct the subagent to:

1. For every unenforced constraint that asserts a codebase property
   (e.g. "types/ is pure", "no imports from cli/"), use Grep to confirm
   it actually holds. Drop any constraint that does not hold.
2. Derive candidate rules from verified constraints using these mappings:
   - Directory responsibility → `PreToolUse` text on
     `Write|Edit|MultiEdit` matching that path
   - Doc tied to source dir → `PostToolUse` hint when source read
   - Data invariant → `UserPromptSubmit` text matching keywords
   - Toolchain constraint → `PreToolUse` command rule
   - Design doc for module → `PostToolUse` hint when module read
3. Format each candidate as a JSON rule object.

**Expected return:**
- Verified constraints (with Grep evidence)
- Candidate rules (JSON array, each annotated with source + verification)

**Wait for completion.**

---

### Presentation

Use the Layer 5 output to present a numbered table of candidate rules.
Each row must include:
- The rule (compact JSON or summary)
- **Source** — which doc/file established the constraint
- **Verification** — what Grep/check confirmed it

Ask: **"Accept all (a), pick by number (e.g. 1,3), or skip (s)?"**

Write accepted rules to `.claude/context-rules.json` (create if absent,
merge if exists).

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
- Phase 0 may create `context-inject.mjs` and modify `settings.json` — only during initial bootstrap.
