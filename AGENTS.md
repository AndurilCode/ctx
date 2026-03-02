## @Skills
You MUST use these skills instead of raw file reads or manual tool invocations.

| Skill | When to use |
|---|---|
| `ctx-search` | Understand codebase — token-aware reading, onboarding, topic search |
| `ctx-code` | Make changes — patch, insert, rename symbols using read-patch cycle |
| `ctx-verify` | Check changes — review diffs, run tests, trace blast radius |
| `hook-context-rules` | Author and maintain context-injection rules |

## @Memory
```
When you encounter a failure that took >3 attempts to resolve, append it to .claude/context-rules.json:
  - Add a hook rule that injects the fix at the right moment.

When you discover a required command not in @Workflow, test it first, then add it if it passes.

When a @Workflow command stops working, mark it and add the fix or remove it.
```
