---
name: ctx-code
description: Make code changes using symbol-anchored edit tools. Use when you know what to change and need to patch, insert, or rename symbols.
argument-hint: "[description of the change]"
---

# Ctx Code

Edit code using symbol-anchored tools. Read structure first, then write back using the same coordinate system.

## Tools

| Tool | Purpose | When to use |
|---|---|---|
| `ctx_outline <FILE>` | Read structure + hashes | Always before editing |
| `ctx_patch` | Replace symbol body | Modifying existing code |
| `ctx_insert` | Add new symbol | Adding new functions/classes/types |
| `ctx_rename` | Rename across codebase | Renaming a symbol and all references |

## Read-Patch Cycle

Every edit follows the same pattern:

1. **Read**: `ctx_outline <file>` to get symbol names + hashes
2. **Edit**: `ctx_patch` / `ctx_insert` / `ctx_rename` using the hash
3. **Verify**: Check the result (tool returns updated outline or diff)

If you get `STALE_READ` — the file changed since you read it. The error returns a fresh outline. Use the new hash and retry.

## ctx_patch

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

Use `ctx_read --lineHashes` to see per-line 2-char hashes, then target specific lines:
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

> **Line hashes are content-based.** The 2-char hash is derived from the line's text content (trimmed, normalized), not its position. The same line content always produces the same hash regardless of where it appears. `ctx_read --lineHashes` shows file-level line numbers for orientation, but `ctx_patch` matches by hash alone — line numbers are ignored. This means you can read line hashes from the full file and use them directly in symbol-scoped or file-scoped patches.

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

Use `ctx_read --lineHashes` to get per-line hashes, then edit without a symbol. Hashes match on content so no symbol/outline is needed:
```json
{
  "file": "config.yaml",
  "lines": [
    { "hash": "f1", "replace": "  port: 8080" }
  ]
}
```

## ctx_insert

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

## ctx_rename

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

Both `ctx_patch` and `ctx_insert` accept `imports` — an array of import strings. They are:
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

- **Modify existing code** → `ctx_patch`
- **Add new code** → `ctx_insert`
- **Rename** → `ctx_rename`
- **Unparseable file** → `ctx_patch` hashline mode
- **Small change in large function** → `ctx_patch` line-hash mode
- **Multiple related changes** → `ctx_patch` multi-symbol batch

## Hand-off

When done editing → use **ctx-verify** with the new targeted verify flow:
- Plan mode (default): `npx @anduril-code/ctx verify <file> --symbol <symbol> [--since <hash>]`
- Exec mode: `npx @anduril-code/ctx verify <file> --exec`

For markdown round-trip fidelity checks (old verify behavior), use:
- `npx @anduril-code/ctx roundtrip <file>`

When you need to understand code first → use **ctx-search**.
