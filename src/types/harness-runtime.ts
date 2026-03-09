import type { CachedRead, InterceptedCall } from './harness.js';

// --- Context Kernel Runtime (Phase 1+) ---

export type ToolClass =
  | 'read'
  | 'search'
  | 'list'
  | 'mutate'
  | 'execute'
  | 'verify'
  | 'context';

export type Surface = 'claude-hook' | 'vscode-hook' | 'mcp' | 'cli' | 'library';

export interface AdapterCapabilities {
  canBlock: boolean;
  canRewrite: boolean;
  canInjectContext: boolean;
  canReturnCached: boolean;
  canInjectBefore: boolean;
}

export interface HarnessRequest {
  surface: Surface;
  event: string;
  toolClass: ToolClass;
  toolName: string;
  args: Record<string, unknown>;
  rawPath?: string;
  prompt?: string;
  taskDescription?: string;
  result?: { tokens?: number; durationMs?: number; success?: boolean; error?: string };
  capabilities: AdapterCapabilities;
}

export type RuntimeResult =
  | { action: 'allow' }
  | { action: 'deny'; output: { type: 'block'; value: string } }
  | { action: 'rewrite'; output: { type: 'context'; value: string } | { type: 'execute'; tool: string; args: Record<string, unknown> } }
  | { action: 'inject_before'; output: { type: 'inject'; calls: InterceptedCall[]; reason: string } }
  | { action: 'return_cached'; output: { type: 'result'; file: string; cached: CachedRead } }
  | { action: 'warn'; output: { type: 'context'; value: string } }
  | { action: 'noop' };
