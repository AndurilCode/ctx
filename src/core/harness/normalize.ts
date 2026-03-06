import type { ToolClass, Surface, AdapterCapabilities, HarnessRequest } from '../../types/harness.js';

const TOOL_CLASS_MAP: Record<string, ToolClass> = {
  Read: 'read', read: 'read',
  Grep: 'search', grep: 'search',
  Glob: 'list', glob: 'list',
  Edit: 'mutate', edit: 'mutate',
  Write: 'mutate', write: 'mutate',
  MultiEdit: 'mutate', multiedit: 'mutate',
  Bash: 'execute', bash: 'execute',
  // ctx tools
  gather: 'search', rank: 'search', symbols: 'search',
  outline: 'read', focus: 'read', context: 'context',
  patch: 'mutate', insert: 'mutate', rename: 'mutate',
};

const SURFACE_CAPABILITIES: Record<Surface, AdapterCapabilities> = {
  'claude-hook': { canBlock: true, canRewrite: false, canInjectContext: true, canReturnCached: false },
  'vscode-hook': { canBlock: true, canRewrite: false, canInjectContext: false, canReturnCached: false },
  'mcp':         { canBlock: true, canRewrite: true,  canInjectContext: true,  canReturnCached: true },
  'cli':         { canBlock: true, canRewrite: true,  canInjectContext: true,  canReturnCached: true },
  'library':     { canBlock: true, canRewrite: true,  canInjectContext: true,  canReturnCached: true },
};

export function classifyTool(toolName: string): ToolClass {
  return TOOL_CLASS_MAP[toolName] ?? 'execute';
}

export function normalizeArgs(args: Record<string, unknown>): Record<string, unknown> {
  const normalized = { ...args };
  if (normalized.file_path && !normalized.file) {
    normalized.file = normalized.file_path;
  }
  return normalized;
}

export interface BuildRequestInput {
  surface: Surface;
  event: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  rawPath?: string;
  prompt?: string;
  taskDescription?: string;
}

export function buildRequest(input: BuildRequestInput): HarnessRequest {
  return {
    surface: input.surface,
    event: input.event,
    toolClass: classifyTool(input.toolName),
    toolName: input.toolName,
    args: normalizeArgs(input.toolInput),
    rawPath: input.rawPath,
    prompt: input.prompt,
    taskDescription: input.taskDescription,
    capabilities: SURFACE_CAPABILITIES[input.surface],
  };
}
