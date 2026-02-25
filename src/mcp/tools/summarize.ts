import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type {
  CallToolResult,
  CreateMessageRequestParamsBase,
  CreateMessageResult,
  SamplingMessage,
} from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';
import { extract } from '../../core/extract.js';
import { resolveMarkdown, textResult } from './common.js';
import type { ExtractLikeToolInput } from './options.js';

interface SummarizeToolInput extends ExtractLikeToolInput {
  markdown?: string;
  file?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

function isSamplingUnavailable(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('method not found') ||
    normalized.includes('sampling') ||
    normalized.includes('not implemented')
  );
}

function fallbackSummary(markdown: string, input: ExtractLikeToolInput): string {
  const output = extract(markdown, {
    onlySections: input.onlySections,
    stripSections: input.stripSections,
  });
  return `[fallback=extract]\n${output}`;
}

function buildSummarizeInput(markdown: string, input: ExtractLikeToolInput): string {
  const hasSectionFilters =
    (input.onlySections?.length ?? 0) > 0 || (input.stripSections?.length ?? 0) > 0;
  if (!hasSectionFilters) {
    return markdown;
  }

  return extract(markdown, {
    onlySections: input.onlySections,
    stripSections: input.stripSections,
    maxChars: Number.MAX_SAFE_INTEGER,
    maxListItems: Number.MAX_SAFE_INTEGER,
    maxTableRows: Number.MAX_SAFE_INTEGER,
  });
}

function summarizePrompt(markdown: string): SamplingMessage {
  return {
    role: 'user',
    content: {
      type: 'text',
      text: `Summarize this markdown for implementation work. Keep constraints, invariants, and actionable steps.\n\n${markdown}`,
    },
  };
}

function getTextContent(result: CreateMessageResult): string {
  if (result.content.type !== 'text') {
    throw new Error('Sampling response was not text content.');
  }

  return result.content.text;
}

export async function runSummarizeTool(
  server: McpServer,
  input: SummarizeToolInput,
): Promise<CallToolResult> {
  const markdown = await resolveMarkdown(input);
  const summarizeInput = buildSummarizeInput(markdown, input);
  const request: CreateMessageRequestParamsBase = {
    messages: [summarizePrompt(summarizeInput)],
    maxTokens: input.maxTokens ?? 500,
    ...(typeof input.temperature === 'number' ? { temperature: input.temperature } : {}),
    ...(input.systemPrompt ? { systemPrompt: input.systemPrompt } : {}),
  };

  try {
    const result = await server.server.createMessage(request);
    return textResult(getTextContent(result));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isSamplingUnavailable(message)) {
      return textResult(fallbackSummary(markdown, input));
    }

    throw new Error(`MCP summarize failed: ${message}`);
  }
}

export function registerSummarizeTool(server: McpServer): void {
  server.registerTool(
    'compact_md_summarize',
    {
      description:
        'Generate an abstractive summary via MCP sampling. Pass either markdown (string) or file (absolute path).',
      inputSchema: {
        markdown: z.string().optional(),
        file: z.string().optional(),
        onlySections: z.array(z.string()).optional(),
        stripSections: z.array(z.string()).optional(),
        maxTokens: z.number().optional(),
        temperature: z.number().optional(),
        systemPrompt: z.string().optional(),
      },
    },
    async (input) => runSummarizeTool(server, input),
  );
}
