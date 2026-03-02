---
name: ctx-code
description: Make code changes using symbol-anchored edit tools. Use when you know what to change and need to patch, insert, or rename symbols.
argument-hint: "[description of the change]"
---

# Ctx Code

Edit code using symbol-anchored tools. Read structure first, then write back using the same coordinate system.

## Tools

All commands are invoked as `npx @anduril-code/ctx <command>`.

| Command | Purpose | When to use |
|---|---|---|
| `outline <FILE>` | Read structure + hashes | Always before editing |
| `patch <FILE> --symbol <name> --hash <hash> --body <code>` | Replace symbol body | Modifying existing code |
| `insert <FILE> --position <pos> --anchor-hash <hash> --body <code>` | Add new symbol | Adding new functions/classes/types |
| `rename <FILE> --symbol <name> --hash <hash> --to <new>` | Rename across codebase | Renaming a symbol and all references |

## Read-Patch Cycle

Every edit follows the same pattern:

1. **Read**: `ctx outline <file>` to get symbol names + hashes
2. **Edit**: `ctx patch` / `ctx insert` / `ctx rename` using the hash
3. **Verify**: Check the result (tool returns updated outline or diff)

If you get `STALE_READ` — the file changed since you read it. The error returns a fresh outline. Use the new hash and retry.

## ctx patch

**Full body replacement** (symbol < 50 lines):
```json
{
  "file": "src/utils.ts",
  "symbol": "parseConfig",
  "hash": "a3f2",
  "body": "export function parseConfig(raw: string): Config {\n  return JSON.parse(raw);\n}"
}
```

**Line-hash mode** (symbol >= 50 lines, change <= 5 lines):

Use `ctx read --lineHashes` to see per-line 4-char hashes, then target specific lines:
```json
{
  "file": "src/utils.ts",
  "symbol": "parseConfig",
  "hash": "a3f2",
  "lines": [
    { "hash": "f1", "replace": "  return JSON.parse(raw) as Config;" }
  ]
}
```

> **Line hashes include position.** The 4-char hash is derived from `lineNumber + lineText`, so identical line text at different lines yields different hashes. Generate hashes from the same content block you plan to patch (symbol body for symbol-scoped edits, full file for hashline mode).

**Multi-symbol atomic batch** (related changes):
```json
{
  "file": "src/utils.ts",
  "patches": [
    { "symbol": "parseConfig", "hash": "a3f2", "body": "..." },
    { "symbol": "validateConfig", "hash": "b7c1", "body": "..." }
  ]
}
```

**Hashline fallback** (unparseable files — config, prose, unsupported languages):

Use `ctx read --lineHashes` to get per-line hashes, then edit without a symbol. Hashes are line-number scoped to that file content, so no symbol/outline is needed:
```json
{
  "file": "config.yaml",
  "lines": [
    { "hash": "f1", "replace": "  port: 8080" }
  ]
}
```

## ctx insert

```json
{
  "file": "src/utils.ts",
  "position": "after:parseConfig",
  "anchor_hash": "a3f2",
  "body": "export function serializeConfig(config: Config): string {\n  return JSON.stringify(config);\n}",
  "imports": ["{ Config } from './types.js'"]
}
```

Positions: `after:<symbol>`, `before:<symbol>`, `after-imports`, `end-of-file`, `start-of-file`

## ctx rename

```json
{
  "file": "src/utils.ts",
  "symbol": "parseConfig",
  "hash": "a3f2",
  "to": "loadConfig",
  "scope": "src/**/*.ts"
}
```

Renames the definition and all references across matching files.

## Import injection

Both `ctx patch` and `ctx insert` accept `imports` — an array of import strings. They are:
- Injected after the last existing import
- Deduplicated against existing imports
- Applied atomically with the body change

## Dry-run

All tools accept `dryRun: true` — returns the diff/summary without writing. Use to preview before committing.

## Error handling

| Error | Meaning | Action |
|---|---|---|
| `STALE_READ` | File changed since last outline | Use the fresh outline in the error, retry with new hash |
| `SYMBOL_NOT_FOUND` | Symbol name not in file | Check the outline in the error, verify name |
| `AMBIGUOUS_SYMBOL` | Multiple symbols with same name | Use the disambiguation list to pick by hash |
| `PARSE_ERROR` | File can't be parsed | Fall back to hashline mode (no symbol, just lines) |

## Decision guide

- **Modify existing code** → `ctx patch`
- **Add new code** → `ctx insert`
- **Rename** → `ctx rename`
- **Unparseable file** → `ctx patch` hashline mode
- **Small change in large function** → `ctx patch` line-hash mode
- **Multiple related changes** → `ctx patch` multi-symbol batch

## Hand-off

When done editing → use **ctx-verify** with the new targeted verify flow:
- Plan mode (default): `npx @anduril-code/ctx verify <file> --symbol <symbol> [--since <hash>]`
- Exec mode: `npx @anduril-code/ctx verify <file> --exec`

For markdown round-trip fidelity checks (old verify behavior), use:
- `npx @anduril-code/ctx roundtrip <file>`

When you need to understand code first → use **ctx-search**.
