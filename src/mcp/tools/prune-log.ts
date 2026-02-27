import { readFile } from 'node:fs/promises';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, CreateMessageResult } from '@modelcontextprotocol/sdk/types.js';
import { pruneLog } from '../../core/prune-log.js';
import type { LogCustomRule, LogPruneProfile } from '../../types/log.js';
import { resolveProfiledOptions } from '../../utils/log-profiles.js';
import { createTokenCounter } from '../../utils/tokens.js';
import { jsonResult } from './common.js';
import { pruneLogInputSchema } from './options.js';

export interface PruneLogToolInput {
  log?: string;
  file?: string;
  profile?: LogPruneProfile;
  stripTimestamps?: 'auto' | 'strip' | 'keep';
  foldProgress?: boolean;
  elidePassingTests?: boolean;
  foldDebugLines?: boolean;
  elideHealthChecks?: boolean;
  foldJsonLines?: boolean;
  foldFrameworkStartup?: boolean;
  stripUserAgents?: boolean;
  dedupeStackTraces?: boolean;
  foldRepeatedLines?: boolean;
  foldGlobalRepeats?: boolean;
  allowTokenExpansion?: boolean;
  thresholdTokens?: number;
  summarizeIfOverThreshold?: boolean;
  maxSummaryTokens?: number;
  customRules?: LogCustomRule[];
}

export async function runPruneLogTool(
  input: PruneLogToolInput,
  server?: McpServer,
): Promise<CallToolResult> {
  const logText = await resolveLog(input);
  const tokenCounter = await createTokenCounter();
  const options = resolveProfiledOptions(input.profile, {
    stripTimestamps: input.stripTimestamps,
    foldProgress: input.foldProgress,
    elidePassingTests: input.elidePassingTests,
    foldDebugLines: input.foldDebugLines,
    elideHealthChecks: input.elideHealthChecks,
    foldJsonLines: input.foldJsonLines,
    foldFrameworkStartup: input.foldFrameworkStartup,
    stripUserAgents: input.stripUserAgents,
    dedupeStackTraces: input.dedupeStackTraces,
    foldRepeatedLines: input.foldRepeatedLines,
    foldGlobalRepeats: input.foldGlobalRepeats,
    allowTokenExpansion: input.allowTokenExpansion,
    thresholdTokens: input.thresholdTokens,
    tokenCounter,
    customRules: input.customRules,
  });
  const result = pruneLog(logText, options);

  if (
    server &&
    input.summarizeIfOverThreshold &&
    result.overThreshold === true &&
    result.output.trim().length > 0
  ) {
    const summary = await summarizeText(server, result.output, input.maxSummaryTokens ?? 300);
    return jsonResult({ ...result, summary, summaryUsed: true });
  }

  return jsonResult({ ...result, summaryUsed: false });
}

export function registerPruneLogTool(server: McpServer): void {
  server.registerTool(
    'ctx_prune',
    {
      description:
        'Lossy pruning for terminal/test/build logs with token gating. Use to keep failures and actionable lines; do not use when exact full logs are required.',
      inputSchema: pruneLogInputSchema,
    },
    async (input) => runPruneLogTool(input, server),
  );
}

async function summarizeText(
  server: McpServer,
  content: string,
  maxTokens: number,
): Promise<string> {
  const response = await server.server.createMessage({
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Summarize this pruned terminal log. Keep failures, errors, and actionable next steps.\n\n${content}`,
        },
      },
    ],
    maxTokens,
  });

  return extractText(response);
}

function extractText(result: CreateMessageResult): string {
  if (result.content.type !== 'text') {
    throw new Error('Sampling response was not text content.');
  }

  return result.content.text;
}

async function resolveLog(input: PruneLogToolInput): Promise<string> {
  if (input.file) {
    return readFile(input.file, 'utf8');
  }

  if (input.log) {
    return input.log;
  }

  throw new Error('Either log or file must be provided.');
}
