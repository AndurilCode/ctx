import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';
import { textResult } from './common.js';
import { type ExtractLikeToolInput, summarizeLikeInputSchema } from './options.js';
import { runSummarizeTool } from './summarize.js';

interface SummarizeBatchToolInput extends ExtractLikeToolInput {
  files: string[];
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  docType?: 'auto' | 'guide' | 'reference' | 'spec';
}

async function summarizeOne(
  server: McpServer,
  file: string,
  input: SummarizeBatchToolInput,
): Promise<{ file: string; summary: string; error?: string }> {
  try {
    const result = await runSummarizeTool(server, {
      file,
      onlySections: input.onlySections,
      stripSections: input.stripSections,
      maxTokens: input.maxTokens,
      temperature: input.temperature,
      systemPrompt: input.systemPrompt,
      docType: input.docType,
    });
    const text = result.content[0];
    const summary = text && text.type === 'text' ? text.text : '';
    return { file, summary };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { file, summary: '', error: message };
  }
}

export async function runSummarizeBatchTool(
  server: McpServer,
  input: SummarizeBatchToolInput,
): Promise<CallToolResult> {
  const results = await Promise.all(input.files.map((file) => summarizeOne(server, file, input)));

  const sections = results.map(({ file, summary, error }) => {
    const header = `### ${file}`;
    const body = error ? `[error: ${error}]` : summary;
    return `${header}\n${body}`;
  });

  return textResult(sections.join('\n\n'));
}

export function registerSummarizeBatchTool(server: McpServer): void {
  server.registerTool(
    'compact_md_summarize_batch',
    {
      description:
        'Summarize multiple files in a single call. Runs compact_md_summarize on each file in parallel and returns all summaries grouped by file path. Ideal for repo onboarding — summarize all package READMEs in one round-trip instead of N sequential calls. Respects caching: repeated calls for unchanged files are instant.',
      inputSchema: {
        files: z.array(z.string()),
        ...summarizeLikeInputSchema,
      },
    },
    async (input) => runSummarizeBatchTool(server, input),
  );
}
