# compact.md — Token-Efficient Markdown for Agent Pipelines

## Project Vision

Build **compact.md**, an open-source TypeScript library and CLI that performs **lossless, bidirectional compression** of Markdown into a token-efficient format designed for agent-to-agent communication.

Markdown has become the lingua franca of AI agents, but it wastes 30-50% of tokens on formatting syntax (table borders, heading markers, repetitive delimiters, whitespace padding). Existing tools like TOON optimize structured data (JSON→compact), and compress.new optimizes web scraping. **Nobody has built the compression layer for the mixed-content documents agents actually produce and consume** — documents containing prose, headings, lists, tables, code blocks, metadata, and embedded structured data together.

compact.md fills this gap.

---

## Tech Stack

- **Language**: TypeScript (strict mode, ES2022 target)
- **Runtime**: Node.js ≥ 20
- **Package manager**: pnpm
- **Build**: tsup (fast, zero-config bundling for both ESM and CJS)
- **Test**: vitest
- **Lint**: biome (single tool for format + lint, replaces eslint + prettier)
- **Markdown AST**: unified + remark-parse + remark-stringify (mdast)
- **Token counting**: tiktoken (optional peer dependency)
- **CLI**: citty (lightweight, TypeScript-native)
- **MCP server**: @modelcontextprotocol/sdk

---

## Core Design Principles

1. **Lossless round-trip**: `expand(compact(markdown)) === markdown` — always, deterministically, no AI needed
2. **Token-first**: Every design decision optimizes for fewer LLM tokens, not human aesthetics
3. **Graceful degradation**: The compact format is readable by humans and fully parseable by LLMs even without expansion
4. **Single Responsibility**: Every file does one thing. No file exceeds ~200 lines. No god files.
5. **Dependency Inversion**: Core logic has zero runtime dependencies. Parsers and integrations are injected.
6. **No duplication**: Shared logic lives in dedicated modules, never copy-pasted across stages.
7. **Streaming-friendly**: Works on chunks, not just full documents
8. **Composable**: Usable as library, CLI, or MCP tool — each is a thin shell over the same core

---

## Architecture

### Guiding Rules

- **No file over 200 lines.** If it grows past that, split it. No exceptions.
- **No barrel exports that re-export everything.** Each module has a focused public API.
- **No circular dependencies.** Dependency flow is strictly: `integrations → core → types`.
- **No business logic in CLI or MCP layers.** They are thin adapters that call core functions.
- **No shared mutable state.** All functions are pure. Options are passed explicitly.
- **No string manipulation in stage files.** Stages operate on AST nodes, not raw strings.
- **DRY via composition, not inheritance.** Shared behaviors are utility functions, not base classes.

### Project Structure

```
compact.md/
├── package.json
├── tsconfig.json
├── biome.json
├── tsup.config.ts
├── vitest.config.ts
├── README.md
├── LICENSE
│
├── src/
│   ├── index.ts                    # Public API: compact, expand, createPipeline
│   │
│   ├── types/
│   │   ├── ast.ts                  # Extended mdast node types for compact format
│   │   ├── options.ts              # CompactOptions, ExpandOptions interfaces
│   │   └── results.ts              # CompactResult, Stats interfaces
│   │
│   ├── core/
│   │   ├── pipeline.ts             # Stage pipeline orchestrator (takes stage[], runs them)
│   │   ├── compact.ts              # compact() — parse → pipeline → serialize (< 40 lines, wiring only)
│   │   ├── expand.ts               # expand() — parse compact → pipeline → serialize md (< 40 lines)
│   │   └── verify.ts               # verify() — round-trip assertion helper
│   │
│   ├── parser/
│   │   ├── markdown-to-ast.ts      # Markdown string → mdast (wraps remark-parse)
│   │   ├── compact-to-ast.ts       # Compact string → mdast (custom parser)
│   │   ├── ast-to-markdown.ts      # mdast → Markdown string (wraps remark-stringify)
│   │   └── ast-to-compact.ts       # mdast → Compact string (custom serializer)
│   │
│   ├── stages/                     # Each stage: (ast, options) => ast — pure transform
│   │   ├── stage.ts                # Stage interface + createStage factory
│   │   ├── structural/
│   │   │   ├── index.ts            # Exports the structural stage (composes sub-transforms)
│   │   │   ├── headings.ts         # Heading transform: ## → :2
│   │   │   ├── tables.ts           # Table transform: remove separator, CSV-style
│   │   │   ├── lists.ts            # List transform: ordered → +, nesting → ..
│   │   │   ├── code-blocks.ts      # Code fence transform: ``` → `
│   │   │   ├── task-lists.ts       # Checkbox transform: - [ ] → []
│   │   │   └── horizontal-rules.ts # HR transform: --- → ~
│   │   ├── whitespace/
│   │   │   ├── index.ts            # Exports the whitespace stage
│   │   │   ├── trailing.ts         # Strip trailing whitespace
│   │   │   └── blank-lines.ts      # Collapse consecutive blank lines
│   │   ├── dedup/
│   │   │   ├── index.ts            # Exports the dedup stage
│   │   │   ├── scanner.ts          # Find repeated substrings (suffix array or rolling hash)
│   │   │   ├── replacer.ts         # Replace substrings with §N tokens
│   │   │   └── dictionary.ts       # Build/parse the §N=value dictionary block
│   │   └── semantic/
│   │       ├── index.ts            # Exports the semantic stage
│   │       ├── comments.ts         # Strip/keep HTML comments
│   │       ├── normalize.ts        # Unicode quotes → ASCII, redundant emphasis
│   │       └── cleanup.ts          # Empty links, trailing # in headings
│   │
│   ├── utils/
│   │   ├── tokens.ts               # Token counting (tiktoken wrapper + simple fallback)
│   │   ├── stats.ts                # Compute compression stats from before/after
│   │   └── text.ts                 # Shared text helpers (escape, quote detection, etc.)
│   │
│   ├── cli/
│   │   ├── index.ts                # CLI entry point, command routing (< 30 lines)
│   │   ├── commands/
│   │   │   ├── compact.ts          # `compact` command — thin adapter over core
│   │   │   ├── expand.ts           # `expand` command — thin adapter over core
│   │   │   ├── verify.ts           # `verify` command — thin adapter over core
│   │   │   └── stats.ts            # `stats` command — compression analysis
│   │   └── io.ts                   # File read/write, stdin/stdout, glob handling
│   │
│   └── mcp/
│       ├── server.ts               # MCP server bootstrap (< 40 lines)
│       └── tools/
│           ├── compact-tool.ts     # MCP tool: compact markdown
│           ├── expand-tool.ts      # MCP tool: expand compact format
│           └── stats-tool.ts       # MCP tool: compression statistics
│
└── tests/
    ├── fixtures/
    │   ├── documents/              # Real-world markdown samples for benchmarks
    │   ├── edge-cases/             # Tricky markdown: nested tables, code in lists, etc.
    │   └── expected/               # Expected compact output for each fixture
    │
    ├── unit/
    │   ├── stages/
    │   │   ├── headings.test.ts    # One test file per transform
    │   │   ├── tables.test.ts
    │   │   ├── lists.test.ts
    │   │   ├── code-blocks.test.ts
    │   │   ├── task-lists.test.ts
    │   │   ├── horizontal-rules.test.ts
    │   │   ├── trailing.test.ts
    │   │   ├── blank-lines.test.ts
    │   │   ├── dedup.test.ts
    │   │   └── semantic.test.ts
    │   ├── parser/
    │   │   ├── compact-to-ast.test.ts
    │   │   └── ast-to-compact.test.ts
    │   └── core/
    │       ├── pipeline.test.ts
    │       └── verify.test.ts
    │
    ├── integration/
    │   ├── round-trip.test.ts      # End-to-end: compact then expand, assert equality
    │   ├── cli.test.ts             # CLI command integration tests
    │   └── mcp.test.ts             # MCP tool integration tests
    │
    └── benchmarks/
        ├── token-savings.bench.ts  # Token reduction across fixture corpus
        └── performance.bench.ts    # Throughput: docs/sec, bytes/sec
```

### Dependency Flow (strict, no cycles)

```
types/          ← depends on nothing
    ↑
utils/          ← depends on types/
    ↑
stages/         ← depends on types/, utils/
    ↑
parser/         ← depends on types/ (+ remark as external)
    ↑
core/           ← depends on types/, stages/, parser/, utils/
    ↑
cli/            ← depends on core/, types/ (+ citty as external)
mcp/            ← depends on core/, types/ (+ @mcp/sdk as external)
    ↑
index.ts        ← re-exports from core/ and types/ only
```

### The Stage Interface

Every compression stage implements the same contract. No exceptions.

```typescript
// src/stages/stage.ts

import type { Root } from 'mdast';
import type { CompactOptions } from '../types/options.ts';

export interface Stage {
  /** Unique identifier for stats and debugging */
  readonly name: string;

  /** Whether this stage is enabled given the current options */
  enabled(options: CompactOptions): boolean;

  /** Pure transform: takes AST, returns new AST. Never mutates input. */
  transform(tree: Root, options: CompactOptions): Root;
}

export function createStage(config: Stage): Stage {
  return Object.freeze(config);
}
```

### The Pipeline

The pipeline is a simple reducer. No magic, no middleware pattern, no plugin system.

```typescript
// src/core/pipeline.ts

import type { Root } from 'mdast';
import type { CompactOptions } from '../types/options.ts';
import type { Stage } from '../stages/stage.ts';

export function runPipeline(
  tree: Root,
  stages: readonly Stage[],
  options: CompactOptions,
): Root {
  return stages
    .filter(stage => stage.enabled(options))
    .reduce((ast, stage) => stage.transform(ast, options), tree);
}
```

That's it. ~10 lines. The pipeline doesn't know what stages exist. Stages are registered in `compact.ts` and `expand.ts` by explicit import — no dynamic discovery, no plugin loading.

---

## The Compact Format Specification

### Version marker (optional first line)

```
%compact.md:1
```

### Headings → Single-character prefix with depth

```
Markdown:          Compact:
# Title        →   :1 Title
## Section     →   :2 Section
### Sub        →   :3 Sub
```

### Paragraphs → Unchanged

Prose passes through as-is. No transformation needed.

### Unordered lists → Dot-indent notation

```
Markdown:                Compact:
- Item one           →   - Item one
- Item two               - Item two
  - Nested               ..- Nested
  - Also nested          ..- Also nested
    - Deep               ....- Deep
```

`..` per indent level. Unambiguous depth, fewer characters than spaces.

### Ordered lists → Implicit numbering

```
Markdown:            Compact:
1. First         →   + First
2. Second            + Second
3. Third             + Third
```

Numbers are regenerated on expansion from position.

### Tables → Header-row + CSV body

```
Markdown:                                    Compact:
| Name  | Role  | Status |               →  |: Name, Role, Status
|-------|-------|--------|                   | Alice, Lead, Active
| Bob   | Dev   | On leave |                | Bob, Dev, On leave
```

- `|:` signals header row
- `|` signals data rows
- Separator row eliminated entirely
- Cell padding eliminated
- Comma-separated (configurable delimiter via options)
- Values containing the delimiter are quoted: `"value, here"`

### Code blocks → Minimal fence

```
Markdown:            Compact:
```python         →  `python
def hello():         def hello():
    print("hi")          print("hi")
```                  `
```

Single backtick + language to open, single backtick to close.

### Horizontal rules → Tilde

```
Markdown:     Compact:
---       →   ~
***       →   ~
___       →   ~
```

### Task lists → Bare brackets

```
Markdown:                Compact:
- [ ] Incomplete     →   [] Incomplete
- [x] Complete           [x] Complete
```

### Blockquotes, bold, italic, links, images, inline code, frontmatter

All pass through unchanged — already token-efficient.

### HTML comments

Stripped by default. Preserved with `keepComments: true`.

### Dedup dictionary (Stage 3 only)

When dedup is enabled and savings exceed 5%:

```
§1=repeated substring here
§2=another repeated phrase
§§
(rest of compact content)
```

`§§` separates dictionary from content.

---

## Public API

### Library

```typescript
import { compact, expand, verify, createPipeline } from 'compact.md';

// Basic usage
const result = compact(markdownString);
const restored = expand(result);

// With options
const result = compact(markdownString, {
  dedup: true,
  semantic: true,
  keepComments: false,
  tableDelimiter: ',',
});

// With stats
const { output, stats } = compact(markdownString, { stats: true });
// stats.originalTokens, stats.compactTokens, stats.savings, stats.byStage

// Round-trip verification
const isLossless = verify(markdownString); // returns boolean

// Custom pipeline (advanced)
const pipeline = createPipeline([structuralStage, whitespaceStage]);
const result = pipeline.run(markdownString);
```

### CLI

```bash
# Compress
compact.md pack input.md -o output.cmd

# Expand
compact.md unpack output.cmd -o restored.md

# Verify round-trip
compact.md verify input.md

# Stats only
compact.md stats input.md

# All stages + stats
compact.md pack input.md --dedup --semantic --stats

# Pipe-friendly
cat doc.md | compact.md pack > compressed.cmd

# Batch
compact.md pack ./docs/**/*.md --out-dir ./compact/
```

### MCP Tools

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

Exposed tools:
- `compact_md_pack` — Takes markdown, returns compact format
- `compact_md_unpack` — Takes compact format, returns markdown
- `compact_md_stats` — Takes markdown, returns compression statistics

---

## Testing Strategy

### Unit tests (one file per transform)
- Each transform tested in isolation: input AST node → output AST node
- Cover: basic case, empty input, edge case, idempotency

### Round-trip property tests
- Use `fast-check` to generate random valid markdown
- Property: `expand(compact(md)) === md` — must hold for all inputs
- Include adversarial inputs: markdown containing compact.md syntax (`:1`, `|:`, etc.)

### Fixture tests
- `tests/fixtures/documents/` — real agent outputs (Claude artifacts, ChatGPT responses, README files)
- Each fixture has a matching expected compact output
- Snapshot tests auto-update with `vitest --update`

### Benchmark tests
- Token savings across the fixture corpus
- Comparison: raw markdown vs compact.md vs TOON (for data sections)
- Performance: throughput in docs/sec and MB/sec
- Target: **30-50% token savings**, **< 5ms** for documents under 50KB

### Integration tests
- CLI end-to-end: file in → file out → verify
- MCP: tool call → response → verify format
- LLM comprehension: send compact format to an LLM, verify it answers correctly

---

## Development Roadmap

### Phase 1: Core (MVP)
- [ ] Project scaffolding (pnpm, tsup, vitest, biome)
- [ ] Type definitions (ast, options, results)
- [ ] Markdown ↔ AST parsers (remark wrappers)
- [ ] Stage interface + pipeline orchestrator
- [ ] Structural stage (headings, tables, lists, code blocks, HRs, task lists)
- [ ] Whitespace stage (trailing, blank lines)
- [ ] Compact → AST parser (reverse direction)
- [ ] AST → compact serializer
- [ ] Round-trip verification
- [ ] Unit tests for every transform
- [ ] CLI (pack, unpack, verify)
- [ ] Publish to npm as `compact.md`

### Phase 2: Advanced Compression
- [ ] Dedup stage (scanner, replacer, dictionary)
- [ ] Semantic stage (comments, normalize, cleanup)
- [ ] Token counting + stats reporting
- [ ] Streaming API for large documents
- [ ] Benchmark suite
- [ ] Property-based round-trip tests

### Phase 3: Ecosystem
- [ ] MCP server with tools
- [ ] GitHub Action (compress docs in CI, report savings in PR comments)
- [ ] VS Code extension (side-by-side preview)
- [ ] llms.txt auto-compression compatibility

### Phase 4: Agent Protocol
- [ ] Semantic annotations (compact form of HTML comment conventions)
- [ ] Section addressing (stable IDs for agent CRUD operations)
- [ ] Delta format (patches instead of full documents for multi-step pipelines)
- [ ] Atomic boundaries (merge-safe zones for multi-agent editing)

---

## File Conventions

- Extension: `.cmd` (Compact Markdown)
- MIME type: `text/compact-markdown` (proposed)
- Version marker: `%compact.md:1` (optional first line)
- Auto-detection heuristics: presence of `:1`..`:6` heading syntax, `|:` table headers

---

## Non-Goals

- **Not a new markup language** — compact.md is a compression of existing Markdown
- **Not lossy summarization** — no AI, purely deterministic and lossless
- **Not a structured data optimizer** — use TOON for JSON; compact.md handles prose-heavy content
- **Not a renderer** — compact.md doesn't display, only compresses and expands

---

## Success Metrics

1. **30-50% token reduction** on typical agent documents
2. **100% lossless round-trip** — zero exceptions, verified by property tests
3. **< 5ms** for documents under 50KB
4. **Zero runtime dependencies** for core encode/decode
5. **< 200 lines per file** — enforced in CI

---

## Example

### Input (Markdown) — ~380 tokens

```markdown
# Project Status Report

## Summary

The migration project is on track. We completed Phase 1 ahead of schedule
and are now beginning Phase 2 work.

## Tasks

- [x] Database migration complete
- [x] API endpoints updated
- [ ] Frontend integration
- [ ] Load testing
  - [ ] Stress tests
  - [ ] Soak tests

## Team Allocation

| Name    | Role      | Status    | Hours |
|---------|-----------|-----------|-------|
| Alice   | Lead      | Active    | 40    |
| Bob     | Backend   | Active    | 35    |
| Charlie | Frontend  | On leave  | 0     |
| Diana   | QA        | Active    | 30    |

## Next Steps

1. Complete frontend integration by Friday
2. Begin load testing next Monday
3. Schedule stakeholder review for March 5

---

*Last updated: 2025-02-24*
```

### Output (compact.md) — ~260 tokens (~32% savings)

```
%compact.md:1

:1 Project Status Report

:2 Summary

The migration project is on track. We completed Phase 1 ahead of schedule
and are now beginning Phase 2 work.

:2 Tasks

[x] Database migration complete
[x] API endpoints updated
[] Frontend integration
[] Load testing
..[] Stress tests
..[] Soak tests

:2 Team Allocation

|: Name, Role, Status, Hours
| Alice, Lead, Active, 40
| Bob, Backend, Active, 35
| Charlie, Frontend, On leave, 0
| Diana, QA, Active, 30

:2 Next Steps

+ Complete frontend integration by Friday
+ Begin load testing next Monday
+ Schedule stakeholder review for March 5

~

*Last updated: 2025-02-24*
```