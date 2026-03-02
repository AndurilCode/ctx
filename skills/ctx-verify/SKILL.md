---
name: ctx-verify
description: Verify code changes by reviewing diffs and running tests. Use after making changes to check correctness.
argument-hint: "[branch, commit range, test command, or blank for current changes]"
---

# Ctx Verify

Verify changes through code review and test execution. Two flows, one skill.

## Tools

Use `npx @anduril-code/ctx` CLI commands.

| Command | Purpose |
|---|---|
| `git diff ... \| npx @anduril-code/ctx changes --context 2` | Compress a diff |
| `npx @anduril-code/ctx outline <FILE>` | Structural outline with hashes |
| `npx @anduril-code/ctx review <QUERY> [--diffBase REF] [--evidence] [--cluster]` | Two-pass risk triage |
| `npx @anduril-code/ctx imports <FILE> [--direction incoming\|outgoing]` | Blast-radius analysis |
| `npx @anduril-code/ctx symbols <QUERY> [--glob PATTERN]` | Find definitions and call sites |
| `<test-cmd> 2>&1 \| npx @anduril-code/ctx prune --profile test` | Prune test output |

## Flow 1: Code Review

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

## Flow 2: Test Execution

1. Determine test command:
   - If `$ARGUMENTS` specifies a command or file, use it directly
   - Otherwise, auto-detect:
     - `package.json` / `bun.lock` → `bun test`
     - `pytest.ini` / `pyproject.toml` → `pytest`
     - `Cargo.toml` → `cargo test`
     - `go.mod` → `go test ./...`
2. Run tests and capture output.
3. Prune logs: `<test-cmd> 2>&1 | npx @anduril-code/ctx prune --profile test`
4. If failing:
   - `npx @anduril-code/ctx outline <FILE>` for failing test files
   - `npx @anduril-code/ctx symbols <NAME>` to trace failing functions
5. Report: status, failures (test name, error, fault location), fix candidates.

## Review output contract

- Every finding must include file path and line reference.
- Focus on behavioral risk, not stylistic nits.
- If no findings: explicitly say no issues found and list residual test risk.

## Stop conditions

- Review: stop when all changed files have been analyzed.
- Test: stop when all failing tests have at least one likely fault location.

## Hand-off

If issues found → use **ctx-search** to investigate or **ctx-code** to fix.
