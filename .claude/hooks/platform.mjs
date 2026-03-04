// Platform detection and input normalization for Claude Code and VS Code Copilot hooks.

// Map VS Code camelCase event names to PascalCase used in rules
const EVENT_ALIASES = {
  preToolUse: 'PreToolUse',
  postToolUse: 'PostToolUse',
  userPromptSubmitted: 'UserPromptSubmit',
  sessionStart: 'SessionStart',
  sessionEnd: 'SessionEnd',
  errorOccurred: 'ErrorOccurred',
  subagentStart: 'SubagentStart',
  postToolUseFailure: 'PostToolUseFailure',
  stop: 'Stop',
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
  const source = pickString(input?.source);
  const agentType = pickString(input?.agent_type, input?.agentType);
  const error = pickString(input?.error, input?.errorMessage);
  const toolResponse = input?.tool_response ?? input?.toolResponse ?? null;
  const content = pickString(toolInput?.content, toolInput?.new_string);
  const stopHookActive = !!(input?.stop_hook_active);
  return { platform, event, toolName, toolInput, prompt, source, agentType, error, toolResponse, content, stopHookActive };
}

// Event classification sets for output formatting
export const PERMISSION_EVENTS = new Set(['PreToolUse']);

export const HSO_CONTEXT_EVENTS = new Set([
  'PreToolUse', 'PostToolUse', 'UserPromptSubmit', 'SessionStart',
  'SubagentStart', 'PostToolUseFailure',
]);

export const DECISION_BLOCK_EVENTS = new Set([
  'PostToolUse', 'UserPromptSubmit', 'Stop',
]);

/**
 * Build the output object for the given platform.
 * Claude Code: hookSpecificOutput for HSO events, decision/reason for block events.
 * VS Code: flat permissionDecision (preToolUse only; other events return null).
 */
export function buildOutput({ platform, event, blocks, allows, additionalContext }) {
  // VS Code: flat permissionDecision on preToolUse only, no context injection
  if (platform === 'vscode') {
    if (event === 'PreToolUse' && (blocks.length > 0 || allows.length > 0)) {
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

  // Claude Code output
  const supportsHSO = HSO_CONTEXT_EVENTS.has(event);
  const supportsDecisionBlock = DECISION_BLOCK_EVENTS.has(event);
  const supportsPermission = PERMISSION_EVENTS.has(event);

  // Build hookSpecificOutput if event supports it
  let hso = null;
  if (supportsHSO) {
    hso = { hookEventName: event };
    if (additionalContext) hso.additionalContext = additionalContext;
    if (supportsPermission) {
      if (blocks.length > 0) {
        hso.permissionDecision = 'deny';
        hso.permissionDecisionReason = blocks.map((m) => m.value).join('\n');
      } else if (allows.length > 0) {
        hso.permissionDecision = 'allow';
        hso.permissionDecisionReason = allows[0].value;
      }
    }
  }

  // Build decision block for non-permission block events
  let result = null;
  if (supportsDecisionBlock && !supportsPermission && blocks.length > 0) {
    result = { decision: 'block', reason: blocks.map((m) => m.value).join('\n') };
  }

  // Merge outputs
  if (result && hso) {
    result.hookSpecificOutput = hso;
    return result;
  }
  if (result) return result;
  if (hso && (hso.additionalContext || hso.permissionDecision)) {
    return { hookSpecificOutput: hso };
  }

  // Fallback: plain text for non-HSO events
  if (!supportsHSO && additionalContext) return additionalContext;
  return null;
}
