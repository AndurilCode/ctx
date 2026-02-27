---
name: compact-review
description: Review code changes using compact.md tools to compress diffs and provide structural context for efficient code review.
disable-model-invocation: false
argument-hint: "[branch, commit range, or blank for current changes]"
---

# Compact Review

Review code changes with a deterministic high-signal chain.

## Tools

Use `npx @anduril-code/compact.md` CLI commands.

| Command | Purpose |
|---|---|
| `git diff ... \| npx @anduril-code/compact.md changes --context 2` | Compress a diff |
| `npx @anduril-code/compact.md outline <FILE>` | Structural outline with line numbers |
| `npx @anduril-code/compact.md review <QUERY> [--diffBase REF] [--evidence] [--cluster]` | Two-pass risk triage on ranked files |
| `npx @anduril-code/compact.md imports <FILE> [--direction incoming\|outgoing]` | Dependency graph for blast-radius analysis |
| `npx @anduril-code/compact.md symbols <QUERY> [--glob PATTERN]` | Find symbol definitions and call sites |

## Default flow

1. Get diff source:
   - If `$ARGUMENTS` is a branch name: `git diff $ARGUMENTS...HEAD`
   - If `$ARGUMENTS` is a commit range (e.g. `abc123..def456`): `git diff $ARGUMENTS`
   - If `$ARGUMENTS` is empty: `git diff HEAD` (staged + unstaged)
2. Compress diff:
   - `git diff ... | npx @anduril-code/compact.md changes --context 2`
   - Large diffs: add `--changesOnly`
3. Add structure:
   - `npx @anduril-code/compact.md outline <FILE>` for every changed source file
4. Trace blast radius (when non-trivial changes):
   - `npx @anduril-code/compact.md imports <FILE> --direction incoming` for changed files
   - `npx @anduril-code/compact.md symbols <NAME>` for renamed/removed exports
5. Escalate analysis:
   - `npx @anduril-code/compact.md review "bugs, regressions, missing tests" --diffBase <REF> --evidence`
6. Report in this order:
   - Findings first, sorted by severity
   - Open questions/assumptions
   - Brief change summary

## Review output contract

- Every finding must include file path and line reference when available.
- Focus on behavioral risk, not stylistic nits.
- If no findings: explicitly say no issues found and list residual test risk.
- Validate each finding with `npx @anduril-code/compact.md outline` or `rg -n` + `sed -n`.
