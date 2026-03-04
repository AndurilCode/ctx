// Platform detection and input normalization for Claude Code and VS Code Copilot hooks.

// Map VS Code camelCase event names to PascalCase used in rules
const EVENT_ALIASES = {
  preToolUse: 'PreToolUse',
  postToolUse: 'PostToolUse',
  userPromptSubmitted: 'UserPromptSubmit',
  sessionStart: 'SessionStart',
  sessionEnd: 'SessionEnd',
  errorOccurred: 'ErrorOccurred',
};

export function normalizeEvent(name) {
  return EVENT_ALIASES[name] || name;
}

export function detectPlatform(payload) {
  if (payload?.hook_event_name || payload?.tool_name || payload?.tool_input) return 'claude';
  if (payload?.hookEventName || payload?.toolName || payload?.toolInput || payload?.toolArgs) return 'vscode';
  return 'claude';
}

export function pickString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return '';
}

export function pickObject(...values) {
  for (const value of values) {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  }
  return {};
}

// Parse VS Code's toolArgs (JSON string) into an object
function parseToolArgs(args) {
  if (typeof args !== 'string' || !args) return null;
  try { return JSON.parse(args); } catch { return null; }
}

/**
 * Extract normalized fields from a hook payload (Claude Code or VS Code).
 * Accepts an optional CLI event arg for VS Code (which omits event from payload).
 */
export function extractInput(input, cliEvent = '') {
  const platform = detectPlatform(input);
  const event = normalizeEvent(pickString(input?.hook_event_name, input?.hookEventName, cliEvent));
  const toolName = pickString(input?.tool_name, input?.toolName, input?.tool?.name);
  const toolInput = pickObject(
    input?.tool_input,
    input?.toolInput,
    input?.tool?.input,
    input?.toolArguments,
    parseToolArgs(input?.toolArgs),
  );
  const prompt = pickString(input?.prompt, input?.userPrompt, input?.message);
  return { platform, event, toolName, toolInput, prompt };
}

/**
 * Build the output object for the given platform.
 * Claude Code: hookSpecificOutput wrapper (or plain text for non-HSO events).
 * VS Code: flat permissionDecision (preToolUse only; other events return null).
 */
export function buildOutput({ platform, event, blocks, allows, additionalContext }) {
  const isPreToolUse = event === 'PreToolUse';

  // VS Code: flat permissionDecision on preToolUse only, no context injection
  if (platform === 'vscode') {
    if (isPreToolUse && (blocks.length > 0 || allows.length > 0)) {
      if (blocks.length > 0) {
        return {
          permissionDecision: 'deny',
          permissionDecisionReason: blocks.map((m) => m.value).join('\n'),
        };
      }
      return {
        permissionDecision: 'allow',
        permissionDecisionReason: allows[0].value,
      };
    }
    return null;
  }

  // Claude Code: events that support hookSpecificOutput.additionalContext
  const HSO_EVENTS = new Set(['PreToolUse', 'PostToolUse', 'UserPromptSubmit', 'SessionStart']);
  const supportsHSO = HSO_EVENTS.has(event);

  if (!supportsHSO) {
    if (additionalContext) return additionalContext;
    return null;
  }

  const hso = { hookEventName: event };
  if (additionalContext) hso.additionalContext = additionalContext;

  if (blocks.length > 0) {
    hso.permissionDecision = 'deny';
    hso.permissionDecisionReason = blocks.map((m) => m.value).join('\n');
  } else if (allows.length > 0) {
    hso.permissionDecision = 'allow';
    hso.permissionDecisionReason = allows[0].value;
  }

  return { hookSpecificOutput: hso };
}
