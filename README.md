# ctx

Token-aware context management for AI agents.

[![npm version](https://img.shields.io/npm/v/@anduril-code/ctx)](https://www.npmjs.com/package/@anduril-code/ctx)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![node >=20](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](package.json)

---

Agents don't need to dump entire codebases into context. **ctx** gives them tools to navigate structure, rank by relevance, extract only what they need, and compress what they carry.

It ships as Claude Code skills, an MCP server, a CLI, and a library.

---

## Claude Code Skills

The fastest way to get started. Three slash commands cover the main agent workflows:

| Command | When to use |
|---|---|
| `/ctx-explore [question or path]` | Navigate a codebase, research a topic, onboard to a new repo |
| `/ctx-review [branch or range]` | Code review — compress diffs, outline changed files, surface risks |
| `/ctx-test [command or file]` | Run tests — prune noisy output, highlight failures with structural context |

Skills are installed automatically when you add ctx as a dependency.

---

## MCP Server

For any MCP-compatible client (Claude Desktop, Cursor, etc.):

```json
{
  "mcpServers": {
    "ctx": {
      "command": "npx",
      "args": ["ctx-mcp"]
    }
  }
}
```

Use the lowest-fidelity tool that answers your question:

**Navigation** _(start here for unknown documents)_
`ctx_sections` · `ctx_locate`

**Code intelligence**
`ctx_tree` · `ctx_rank` · `ctx_gather` · `ctx_context` · `ctx_outline` · `ctx_imports` · `ctx_symbols` · `ctx_review`

**Extraction & compression**
`ctx_extract` · `ctx_compact` · `ctx_expand` · `ctx_changes` · `ctx_prune`

**AI summarization** _(lossy, cached)_
`ctx_summarize` · `ctx_batch`

**Typical agent reading flow:**
```
ctx_sections → budget the doc
ctx_extract  → pull the sections you need
ctx_compact  → compress if carrying the full doc
```

---

## CLI

```bash
npx @anduril-code/ctx <command> [options]
```

```bash
# Context assembly
ctx gather "authentication flow" --maxTokens 2000
ctx rank "error handling" --glob "**/*.ts"
ctx tree src/ --depth 3

# Code intelligence
ctx outline src/core/compact.ts
ctx imports src/stages/tables.ts
ctx symbols "compact" --kind function
ctx review "security" --diffBase main --evidence

# Document navigation
ctx sections docs/api.md
ctx extract docs/api.md --onlySections "Authentication"
ctx summarize docs/api.md

# Compression
git diff | ctx changes --changes-only
cat test.log | ctx prune --profile test
cat doc.md | ctx compact | ctx expand   # round-trips exactly
```

---

## Library

For embedding compression primitives in your own pipeline:

```bash
npm install @anduril-code/ctx
```

```typescript
import { compact, expand, pruneLog, compactDiff } from '@anduril-code/ctx';

// Lossless Markdown compression — expand(compact(md)) === md, always
const { output, stats } = compact(md, { dedup: true, stats: true });
console.log(stats.savings); // e.g. 0.38

// Log pruning
const { output: pruned } = pruneLog(testOutput, { profile: 'test' });

// Diff compression
const compressed = compactDiff(gitDiff, { changesOnly: true });
```

See TypeScript types for full option references.

---

## Development

```bash
bun install
bun test
bun run build       # ESM + CJS + type declarations
bun run lint        # biome check
bun run typecheck   # tsc --noEmit
```

---

## Contributing

Read [`AGENTS.md`](AGENTS.md) — it documents the architecture, dependency rules, and invariants.

---

MIT
