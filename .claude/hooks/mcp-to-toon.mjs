#!/usr/bin/env node
// PostToolUse hook: Convert JSON tool output to TOON format.
//
// Intercepts tool_response from MCP tools (mcp_*) and Bash, converting
// JSON payloads to TOON to save tokens for the model.
//
// Compatible with both VS Code Copilot (additionalContext) and
// Claude Code CLI (updatedMCPToolOutput).

import { encode } from '@toon-format/toon';

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);

let input;
try {
  input = JSON.parse(Buffer.concat(chunks).toString());
} catch {
  process.exit(0);
}

const { tool_name, tool_response } = input;

const CONVERTIBLE = /^(mcp_.*|Bash)$/;
if (!CONVERTIBLE.test(tool_name ?? '')) process.exit(0);

// tool_response may already be a string (some MCP servers return plain text)
let data;
if (typeof tool_response === 'string') {
  try {
    data = JSON.parse(tool_response);
  } catch {
    // Not JSON — nothing to convert
    process.exit(0);
  }
} else if (tool_response != null && typeof tool_response === 'object') {
  data = tool_response;
} else {
  process.exit(0);
}

// Recursively unpack stringified JSON so TOON can compress the full structure
function deepParseJson(val) {
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if ((trimmed[0] === '{' || trimmed[0] === '[') && trimmed.length > 2) {
      try {
        return deepParseJson(JSON.parse(trimmed));
      } catch {
        return val;
      }
    }
    return val;
  }
  if (Array.isArray(val)) return val.map(deepParseJson);
  if (val != null && typeof val === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(val)) out[k] = deepParseJson(v);
    return out;
  }
  return val;
}

data = deepParseJson(data);

// Encode to TOON
let toon;
try {
  toon = encode(data);
} catch {
  // If TOON encoding fails (e.g. unsupported structure), leave output as-is
  process.exit(0);
}

// Size guard: compare against the ORIGINAL tool_response, not the deep-parsed JSON.
// The original often has double-escaped stringified JSON which inflates its size.
const originalSize =
  typeof tool_response === 'string' ? tool_response.length : JSON.stringify(tool_response).length;

if (toon.length >= originalSize) process.exit(0);

// Return the TOON-encoded output.
// - updatedMCPToolOutput: used by Claude Code CLI to replace MCP response
// - additionalContext: used by VS Code Copilot to inject into conversation
const result = {
  hookSpecificOutput: {
    hookEventName: 'PostToolUse',
    updatedMCPToolOutput: toon,
    additionalContext: `[TOON-encoded MCP response]\n${toon}`,
  },
};

process.stdout.write(JSON.stringify(result));
