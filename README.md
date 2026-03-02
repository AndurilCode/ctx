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

The fastest way to get started. Four skills cover the main agent workflows:

| Skill | When to use |
|---|---|
| `/ctx-search [question or path]` | Navigate a codebase, research a topic, onboard to a new repo |
| `/ctx-code [file::symbol]` | Make changes — patch, insert, or rename symbols using read-patch cycle |
| `/ctx-verify [file or command]` | Review diffs, run tests, check correctness after changes |
| `/rules-to-hook` | Author and maintain context-injection rules |

**Install via add-skill:**

```bash
# All ctx skills
npx add-skill AndurilCode/ctx

# Or pick specific ones
npx add-skill AndurilCode/ctx --skill ctx-search --skill ctx-code --skill ctx-verify
```

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
`ctx_sections` · `ctx_read`

**Code intelligence**
`ctx_tree` · `ctx_rank` · `ctx_gather` · `ctx_context` · `ctx_outline` · `ctx_imports` · `ctx_symbols` · `ctx_review` · `ctx_focus` · `ctx_verify` · `ctx_roundtrip_verify`

**Extraction & compression**
`ctx_extract` · `ctx_compact` · `ctx_expand` · `ctx_changes` · `ctx_prune`

**Code editing**
`ctx_patch` · `ctx_insert` · `ctx_rename`

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
ctx context src/core/patch.ts src/core/focus.ts --maxTokens 3000
ctx tree src/ --depth 3
ctx read src/core/compact.ts --maxTokens 500
ctx tokens src/core/compact.ts

# Code intelligence
ctx outline src/core/compact.ts
ctx imports src/core/imports.ts
ctx symbols "compact" --kind function
ctx review "security" --diffBase main --evidence
ctx focus src/core/patch.ts::patch
ctx verify src/core/patch.ts --symbol patch --since a3b2
ctx verify src/core/patch.ts --exec

# Code editing
ctx patch src/utils/text.ts --symbol normalize --hash a3f2 --body '...'
ctx insert src/utils/text.ts --position after:normalize --anchor-hash a3f2 --body '...'
ctx rename src/utils/text.ts --symbol normalize --hash a3f2 --to normalizeText

# Document navigation
ctx sections README.md
ctx locate "authentication" README.md AGENTS.md
ctx extract README.md --onlySections "CLI"
ctx metrics README.md

# Compression
git diff | ctx changes --changes-only
cat test.log | ctx prune --profile test
cat doc.md | ctx compact | ctx expand   # round-trips exactly
ctx roundtrip doc.md                    # round-trip validation command
```

---

## Library

For embedding compression primitives in your own pipeline:

```bash
npm install @anduril-code/ctx
```

```typescript
import {
  compact, expand, pruneLog, compactDiff,
  codeOutline, tree, budgetedRead, relevance, review,
  autoContext, assembleContext, fileImports, symbols, focus,
  patch, insert, rename,
} from '@anduril-code/ctx';

// Lossless Markdown compression — expand(compact(md)) === md, always
const { output, stats } = compact(md, { dedup: true, stats: true });
console.log(stats.savings); // e.g. 0.38

// Log pruning
const { output: pruned } = pruneLog(testOutput, { profile: 'test' });

// Diff compression
const compressed = compactDiff(gitDiff, { changesOnly: true });

// Code intelligence
const outline = await codeOutline('src/index.ts');
const ranked = await relevance('error handling', { glob: '**/*.ts' });
const context = await autoContext('auth flow', { maxTokens: 2000 });

// Symbol-anchored editing
const result = await patch({ file: 'src/utils.ts', symbol: 'parse', hash: 'a3f2', body: '...' });
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
