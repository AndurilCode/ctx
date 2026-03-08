---
name: ctx-verify
description: Verify code changes by reviewing diffs and running tests. Use after making changes to check correctness.
argument-hint: "[branch, commit range, test command, or blank for current changes]"
---

# Ctx Verify

Verify changes through targeted planning/execution plus optional review triage.

## Tools

Use `npx @anduril-code/ctx` CLI commands.

| Command | Purpose |
|---|---|
| `npx @anduril-code/ctx verify <file> [--symbol <name>] [--since <hash>]` | Build targeted verification plan (default, read-only) |
| `npx @anduril-code/ctx verify <file> --exec [--testCommand ...] [--typeCommand ...]` | Execute targeted verification plan |
| `npx @anduril-code/ctx verify --diff` | Build plan for changed files in working tree |
| `git diff ... \| npx @anduril-code/ctx changes --context 2` | Compress a diff |
| `npx @anduril-code/ctx outline <FILE>` | Structural outline with hashes |
| `npx @anduril-code/ctx review <QUERY> [--diffBase REF] [--evidence] [--cluster]` | Two-pass risk triage |
| `npx @anduril-code/ctx imports <FILE> [--direction incoming\|outgoing]` | Blast-radius analysis |
| `npx @anduril-code/ctx symbols <QUERY> [--glob PATTERN]` | Find definitions and call sites |
| `<test-cmd> 2>&1 \| npx @anduril-code/ctx prune --profile test` | Prune test output |
| `npx @anduril-code/ctx roundtrip <file>` | Markdown round-trip fidelity check (legacy verify behavior) |
| `npx @anduril-code/ctx exec '<CODE>'` | Compose multi-step verification in one call |

## Flow 1: Targeted Verify (primary)

1. Build plan (default mode):
   - `npx @anduril-code/ctx verify <file> --symbol <name> --since <hash>`
   - or `npx @anduril-code/ctx verify --diff`
2. Inspect:
   - changed symbols and caller impact
   - generated type-check and targeted test commands
3. Execute when ready:
   - `npx @anduril-code/ctx verify <file> --exec`
   - optionally override commands with `--testCommand` and `--typeCommand`
4. If exec fails:
   - re-run with narrowed symbol/file scope
   - use `outline`, `symbols`, and `imports` for fault localization
5. Report:
   - plan quality (coverage + relevance)
   - exec outcomes (pass/fail/timeout)
   - likely fault locations and fix candidates

## Flow 2: Code Review (secondary)

1. Get diff source:
   - If `$ARGUMENTS` is a branch name: `git diff $ARGUMENTS...HEAD`
   - If `$ARGUMENTS` is a commit range: `git diff $ARGUMENTS`
   - If `$ARGUMENTS` is empty: `git diff HEAD` (staged + unstaged)
2. Compress diff:
   - `git diff ... | npx @anduril-code/ctx changes --context 2`
   - Large diffs: add `--changesOnly`
3. Add structure:
   - `npx @anduril-code/ctx outline <FILE>` for every changed source file
4. Trace blast radius (when non-trivial changes):
   - `npx @anduril-code/ctx imports <FILE> --direction incoming` for changed files
   - `npx @anduril-code/ctx symbols <NAME>` for renamed/removed exports
5. Escalate:
   - `npx @anduril-code/ctx review "bugs, regressions, missing tests" --diffBase <REF> --evidence`
6. Report: findings (by severity), open questions, change summary.

## Flow 3: Round-trip Fidelity (markdown-only)

1. Use `npx @anduril-code/ctx roundtrip <file>` when validating compact/expand fidelity.
2. Do not use `ctx verify` for markdown fidelity checks; `ctx verify` is now code-change verification.

## Flow 4: Composed Verification via exec

Use `exec` to combine multiple verification steps in a single call when tracing blast radius across files:

```bash
npx @anduril-code/ctx exec '
const changed = ["src/core/exec/sandbox.ts", "src/core/exec/api-surface.ts"];
const outlines = await Promise.all(changed.map(f => outline(f)));
const blastRadius = await Promise.all(changed.map(f => imports({ file: f, direction: "incoming" })));
const syms = await symbols({ query: "executeCode" });
json({ outlines, blastRadius, syms });
'
```

Prefer `exec` when verification requires 3+ ctx calls that feed into each other (e.g., outline → imports → symbols).

## Review output contract

- Every finding must include file path and line reference.
- Focus on behavioral risk, not stylistic nits.
- If no findings: explicitly say no issues found and list residual test risk.

## Stop conditions

- Review: stop when all changed files have been analyzed.
- Verify exec: stop when all failing checks/tests have at least one likely fault location.

## Hand-off

If issues found → use **ctx-search** to investigate or **ctx-code** to fix.
