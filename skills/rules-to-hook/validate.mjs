// Rule validation for context-rules.json entries.

const INJECT_KEYS = ['text', 'hint', 'learnings', 'shell', 'block', 'allow'];

export function isValidRule(rule) {
  if (!rule.inject) return false;
  // Reject rules with multiple inject keys
  if (INJECT_KEYS.filter(k => k in rule.inject).length !== 1) return false;
  // Reject rules with explicitly empty path
  const when = rule.when ?? {};
  if ('path' in when && !when.path) return false;
  return true;
}
