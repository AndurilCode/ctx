---
name: ctx-test
description: Run tests and analyze results using ctx log pruning to compress noisy output and surface failures.
disable-model-invocation: true
argument-hint: "[test command or file, blank to auto-detect]"
---

# Ctx Test

Run tests with deterministic log compression and failure triage.

## Tools

Use `npx @anduril-code/ctx` CLI commands.

| Command | Purpose |
|---|---|
| `cmd \| npx @anduril-code/ctx prune --profile test` | Prune test output (pipe mode) |
| `npx @anduril-code/ctx prune --profile test [FILE]` | Prune test output (file mode) |
| `npx @anduril-code/ctx outline <FILE>` | Structural outline with line numbers |
| `npx @anduril-code/ctx symbols <QUERY> [--glob PATTERN]` | Trace failing symbols to source |

## Default flow

1. Determine test command:
   - If `$ARGUMENTS` specifies a command or file, use it directly
   - Otherwise, auto-detect the test runner:
     - `package.json` scripts (`test`, `vitest`, `jest`) or `bun.lock` / `bun.lockb` → `bun test`
     - `pytest.ini`, `pyproject.toml` → `pytest`
     - `Cargo.toml` → `cargo test`
     - `go.mod` → `go test ./...`
   - If a specific test file is given, scope the command to that file
2. Run tests and capture combined output + exit code.
3. Prune logs:
   - `<test-cmd> 2>&1 | npx @anduril-code/ctx prune --profile test`
4. If failing:
   - Extract failing test files and stack-trace source files
   - `npx @anduril-code/ctx outline <FILE>` for each failing file
   - `npx @anduril-code/ctx symbols <NAME>` to trace failing functions to definitions
5. Report in this order:
   - Status (pass/fail + counts)
   - Failures (test name, error, likely fault location)
   - Root-cause pattern summary
   - Concrete fix candidates with file references

## Stop conditions

- Stop when all failing tests have at least one likely fault location.
- If no failures remain, return concise pass summary only.
