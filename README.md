# compact.md

Token-efficient Markdown compression and document intelligence for agent pipelines.

[![npm version](https://img.shields.io/npm/v/compact.md)](https://www.npmjs.com/package/compact.md)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![node >=20](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](package.json)
[![bun >=1.3](https://img.shields.io/badge/bun-%3E%3D1.3-brightgreen)](package.json)

---

## Why compact.md

Markdown has become the lingua franca of AI agents, but it wastes 30–50% of tokens on formatting syntax: table borders, heading markers, repetitive delimiters, whitespace padding. Every token spent on structure is a token not spent on content.

**compact.md** gives agents a spectrum of strategies for fitting more useful content into a context window:

- **Lossless compression** — `compact()`/`expand()` deterministically encode and decode Markdown with zero information loss. `expand(compact(md)) === md`, always.
- **Targeted extraction** — pull out only the sections an agent needs, with optional truncation limits.
- **AI summarization** — abstractive LLM summaries (~200 tokens by default) for breadth-first exploration of large docs, with results cached so repeated calls are free.

The library and CLI expose the lossless path. The MCP server exposes all three.

---

## Features

- **Lossless round-trip** — `expand(compact(md)) === md`, always, verified by property tests
- **30–50% token reduction** on typical agent documents (lossless path)
- **Zero runtime dependencies** for the core encode/decode path
- **Library + CLI + MCP server** — one package, three interfaces
- **Stage-based pipeline** — structural, whitespace, dedup, and semantic stages, each independently toggleable
- **Readable without expansion** — compact format is parseable by LLMs even before expanding
- **Section navigation** — list document structure with per-section token counts before loading any content
- **Targeted extraction** — retrieve specific sections verbatim with character/row/item truncation limits
- **AI summarization** — LLM-powered abstractive summaries with `docType`-aware prompts and in-process caching

---

## Installation

```bash
npm install compact.md
# or
bun add compact.md
```

---

## Quick Start

```typescript
import { compact, expand, verify } from 'compact.md';

const md = `# Project Status

## Tasks

- [x] Database migration
- [ ] Frontend integration

| Name  | Role    | Status |
|-------|---------|--------|
| Alice | Lead    | Active |
| Bob   | Backend | Active |
`;

const result = compact(md);
console.log(result.output);
// # Project Status
// ## Tasks
// [x] Database migration
// [] Frontend integration
// |: Name, Role, Status
// | Alice, Lead, Active
// | Bob, Backend, Active

const restored = expand(result.output);
// restored === md  ✓

console.log(verify(md)); // true
```

**With options and stats:**

```typescript
const { output, stats } = compact(md, {
  dedup: true,
  semantic: true,
  stats: true,
});

console.log(stats.savings); // e.g. 0.38 (38% fewer tokens)
```

---

## API Reference

### Library

```typescript
import { compact, compactDiff, expand, verify, createPipeline } from 'compact.md';
```

#### `compact(markdown, options?): CompactResult`

Compresses a Markdown string. Returns `{ output: string, stats? }`.

| Option | Type | Default | Description |
|---|---|---|---|
| `dedup` | `boolean` | `false` | Enable deduplication stage (dictionary substitution for repeated substrings) |
| `semantic` | `boolean` | `false` | Enable semantic stage (strip redundant markup, normalize unicode punctuation) |
| `keepComments` | `boolean` | `false` | Preserve HTML comments (stripped by default) |
| `onlySections` | `string[]` | — | Keep only the listed heading sections |
| `stripSections` | `string[]` | — | Remove the listed heading sections |
| `unwrapLines` | `boolean` | `false` | Join soft-wrapped paragraph lines into a single line |
| `tableDelimiter` | `string` | `","` | Cell delimiter used in compact table rows |
| `versionMarker` | `boolean` | `false` | Prepend `%compact.md:1` version header |
| `stats` | `boolean` | `false` | Compute and return token-saving statistics |

#### `expand(compactText, options?): string`

Expands compact.md format back to standard Markdown.

| Option | Type | Default | Description |
|---|---|---|---|
| `tableDelimiter` | `string` | `","` | Cell delimiter used when reading compact table rows |

#### `verify(markdown, options?): boolean`

Returns `true` if `expand(compact(markdown)) === markdown`.

#### `compactDiff(diffText, options?): string`

Compresses unified git diff text (lossy, one-way). Useful for PR review and change analysis.

| Option | Type | Default | Description |
|---|---|---|---|
| `context` | `number` | `1` | Context lines to keep around changed lines (`0` strips all context) |
| `compactHeaders` | `boolean` | `true` | Replace `diff/index/---/+++` header block with `=== path` |
| `changesOnly` | `boolean` | `false` | Emit only file path + changed lines (`+`/`-`) |

#### `createPipeline(stages): Pipeline`

Assembles a custom pipeline from an ordered array of `Stage` objects for advanced use cases.

---

### CLI

Install globally or run via `npx`:

```bash
npx compact.md <command> [options]
```

| Command | Description |
|---|---|
| `pack` | Compress a Markdown file to compact.md format |
| `diff` | Compress unified diff output for lower token usage |
| `unpack` | Expand a compact.md file back to Markdown |
| `extract` | Extract and compress specific sections only |
| `verify` | Assert lossless round-trip for a file |
| `stats` | Report token savings without writing output |
| `sections` | List the heading sections in a document |
| `search-sections` | Search sections by keyword |

```bash
# Compress
compact.md pack input.md -o output.cmd

# Expand
compact.md unpack output.cmd -o restored.md

# Verify round-trip
compact.md verify input.md

# Stats only
compact.md stats input.md

# Pipe-friendly
cat doc.md | compact.md pack > compressed.cmd
git diff | compact.md diff --changes-only

# With options
compact.md pack input.md --dedup --semantic --stats
```

---

### MCP Server

Add to your MCP client config:

```json
{
  "mcpServers": {
    "compact-md": {
      "command": "npx",
      "args": ["compact-md-mcp"]
    }
  }
}
```

The MCP server exposes a spectrum of token-reduction strategies. Tools are grouped below by fidelity tier — from lossless to AI-summarized:

**Lossless compression**

| Tool | Description |
|---|---|
| `compact_md_pack` | Compress Markdown to compact.md format — fully reversible |
| `compact_md_unpack` | Expand compact.md format back to standard Markdown |
| `compact_md_verify` | Assert that round-trip is lossless for a given input |
| `compact_md_stats` | Report token savings without writing any output |
| `compact_md_diff` | Compress unified git diff text (one-way, lossy) |

**Section navigation** _(start here for unknown documents)_

| Tool | Description |
|---|---|
| `compact_md_sections` | List the section TOC with per-section token counts — use this first to budget context before loading content |
| `compact_md_search_sections` | Search sections by keyword to find relevant content without reading the whole document |

**Targeted extraction** _(verbatim content, optionally truncated)_

| Tool | Description |
|---|---|
| `compact_md_extract` | Retrieve exact section content, with optional `maxChars` / `maxListItems` / `maxTableRows` truncation |

**AI summarization** _(lossy, cached, higher token reduction)_

| Tool | Description |
|---|---|
| `compact_md_summarize` | Abstractive LLM summary (~200 tokens by default). Supports `docType`: `auto` \| `guide` \| `reference` \| `spec`. Results are cached — repeated calls on unchanged files are instant. |
| `compact_md_summarize_batch` | Summarize multiple files in parallel in a single round-trip. Ideal for repo onboarding. |

**Recommended agent workflow**

```
1. compact_md_sections          → see document structure + token sizes
2a. doc is small (<500 tokens)  → read it directly
2b. need a high-level gist      → compact_md_summarize
2c. need a specific section     → compact_md_extract with onlySections
2d. need compressed full doc    → compact_md_pack
```

---

## Compact Format Reference

Every transformation is lossless and reverses exactly on `expand`. Most of the token savings come from tables, list syntax, and tight block packing — not from rewriting every construct.

| Construct | Standard Markdown | compact.md output |
|---|---|---|
| Heading | `## Section` | `## Section` _(unchanged)_ |
| Ordered list item | `1. First` | `+ First` |
| Nested unordered item | `··- Nested` _(2-space indent)_ | `..- Nested` |
| Table header row | `\| A \| B \|` + `\|---|---|` separator | `\|: A, B` |
| Table data row | `\| 1 \| 2 \|` | `\| 1, 2` |
| Task list (incomplete) | `- [ ] Todo` | `[] Todo` |
| Task list (complete) | `- [x] Done` | `[x] Done` |
| Code fence | ` ```python … ``` ` | ` ```python … ``` ` _(unchanged)_ |
| Horizontal rule | `---` | `---` _(unchanged)_ |
| Version marker (optional) | — | `%compact.md:1` |

**What changes:** tables (separator row and padding eliminated), ordered list numbers (`1.` → `+`), nested list indentation (spaces → `..` per level), and task list brackets (`- [ ]` → `[]`). Consecutive compact blocks (headings, tables, HR) are also tightly packed with a single newline between them instead of a blank line.

**What passes through unchanged:** headings, code blocks, horizontal rules, paragraphs, blockquotes, bold, italic, inline code, links, images, and frontmatter.

> **Note:** The parser also accepts a shorthand heading syntax (`:1 Title`, `:2 Section`, …) and single-backtick code fences (`` `python … ` ``) for manually authored compact input, but `compact()` does not produce these forms.

### Dedup dictionary

When `dedup: true` and savings exceed 5%, repeated substrings are replaced with `§N` tokens and a dictionary is prepended:

```
§1=repeated substring here
§2=another repeated phrase
§§
(rest of compact content)
```

---

## Development

```bash
bun install         # install dependencies
bun test            # run tests
bun run build       # compile ESM + CJS + type declarations
bun run lint        # biome check (lint + format)
bun run typecheck   # tsc --noEmit
```

---

## Contributing

Read [`AGENTS.md`](AGENTS.md) before contributing — it documents the architecture invariants, the one-way dependency graph, and the rules that keep files small and the core zero-dependency.

The primary invariant is **lossless round-trip**: `expand(compact(md)) === md` for all inputs, always. When in doubt between two approaches, prefer the one that makes this guarantee easier to maintain.

---

## License

MIT
