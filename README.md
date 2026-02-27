# ctx

Token-aware context management for AI agents.

[![npm version](https://img.shields.io/npm/v/@anduril-code/ctx)](https://www.npmjs.com/package/@anduril-code/ctx)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![node >=20](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](package.json)

---

**ctx** gives AI agents a token-aware view of any codebase or document set. Instead of dumping raw files into a context window, agents can navigate structure, rank by relevance, extract only what they need, and compress what they carry — all through a single tool.

It ships as a library, CLI, MCP server, and Claude Code skills.

---

## Installation

```bash
npm install @anduril-code/ctx
# or
bun add @anduril-code/ctx
```

---

## Library

```typescript
import { compact, expand, verify } from '@anduril-code/ctx';

const result = compact(md);          // compress
const restored = expand(result.output); // restore — identical to input
verify(md);                          // true

// With options
const { output, stats } = compact(md, { dedup: true, semantic: true, stats: true });
console.log(stats.savings);          // e.g. 0.38 (38% fewer tokens)
```

**Key exports:** `compact` · `expand` · `verify` · `compactDiff` · `pruneLog` · `createPipeline`

See TypeScript types for full option references — all options have JSDoc descriptions.

---

## CLI

```bash
npx @anduril-code/ctx <command> [options]
```

| Command | Description |
|---|---|
| `compact` | Compress a Markdown file (lossless) |
| `expand` | Restore compact format back to Markdown |
| `verify` | Assert lossless round-trip for a file |
| `metrics` | Report token savings without writing output |
| `changes` | Compress unified diff output |
| `prune` | Lossy pruning for terminal/log/test output |
| `sections` | List document sections with per-section token counts |
| `locate` | Search sections by keyword |
| `extract` | Pull specific sections verbatim |
| `outline` | Structural code outline with line numbers |
| `gather` | Auto-discover and assemble token-budgeted context |
| `rank` | Rank files by relevance to a query |
| `context` | Assemble context from an explicit file list |
| `review` | Two-pass risk triage across ranked files |
| `tree` | Directory tree with per-file token counts |
| `imports` | Show import graph edges for a file |
| `symbols` | Find symbol definitions and usage sites |
| `summarize` | Abstractive LLM summary of a document |
| `batch` | Summarize multiple files in one call |

```bash
# Common patterns
cat doc.md | ctx compact > compressed.cmd
git diff | ctx changes --changes-only
cat test.log | ctx prune --profile test --stats
ctx gather "authentication flow" --maxTokens 2000
ctx review "security issues" --diffBase main --evidence
```

---

## MCP Server

Add to your MCP client config:

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

Tools are grouped by fidelity — use the lowest fidelity that answers your question:

**Lossless** — `ctx_compact` · `ctx_expand` · `ctx_verify` · `ctx_metrics` · `ctx_changes` · `ctx_prune`

**Navigation** _(start here for unknown documents)_ — `ctx_sections` · `ctx_locate`

**Extraction** _(verbatim, optionally truncated)_ — `ctx_extract`

**Code intelligence** — `ctx_outline` · `ctx_gather` · `ctx_context` · `ctx_rank` · `ctx_review` · `ctx_tree` · `ctx_imports` · `ctx_symbols`

**AI summarization** _(lossy, cached)_ — `ctx_summarize` · `ctx_batch`

**Recommended reading workflow:**
```
ctx_sections → ctx_extract (specific section) | ctx_summarize (gist) | ctx_compact (full doc)
```

---

## Claude Code Skills

Three slash commands wire ctx into your Claude Code workflow:

| Skill | Command | When to use |
|---|---|---|
| `ctx-explore` | `/ctx-explore [question or path]` | Codebase navigation, onboarding, topic search |
| `ctx-review` | `/ctx-review [branch or range]` | Code review — compress diffs, surface risks |
| `ctx-test` | `/ctx-test [command or file]` | Test runs — prune noisy output, highlight failures |

Skills are installed automatically when you add ctx as a dependency. Each skill uses `npx @anduril-code/ctx` commands with a deterministic breadth-first flow.

---

## Compact Format

What changes: table separators and padding removed, ordered list numbers (`1.` → `+`), nested list indentation (spaces → `..` per level), task list brackets (`- [ ]` → `[]`), blank lines between consecutive blocks collapsed.

What passes through unchanged: headings, code blocks, paragraphs, blockquotes, inline formatting, links, images, frontmatter.

| Construct | Standard Markdown | ctx output |
|---|---|---|
| Ordered list item | `1. First` | `+ First` |
| Nested list item | `··- Nested` | `..- Nested` |
| Table header | `\| A \| B \|` + separator | `\|: A, B` |
| Table row | `\| 1 \| 2 \|` | `\| 1, 2` |
| Task (open) | `- [ ] Todo` | `[] Todo` |
| Task (done) | `- [x] Done` | `[x] Done` |

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

Read [`AGENTS.md`](AGENTS.md) before contributing — it documents the architecture, one-way dependency graph, and file-size rules.

The compression path guarantees **lossless round-trip**: `expand(compact(md)) === md` for all inputs. When in doubt between two approaches, prefer the one that makes this easier to maintain.

---

MIT
