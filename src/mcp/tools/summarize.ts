import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type {
  CallToolResult,
  CreateMessageRequestParamsBase,
  CreateMessageResult,
  SamplingMessage,
} from '@modelcontextprotocol/sdk/types.js';
import { extract } from '../../core/extract.js';
import { parseFrontmatter } from '../../utils/frontmatter.js';
import { hashString } from '../../utils/hash.js';
import { getCached, setCached } from '../../utils/summary-cache.js';
import { resolveMarkdown, textResultWithFrontmatter } from './common.js';
import {
  type ExtractLikeToolInput,
  markdownOrFileSchema,
  summarizeLikeInputSchema,
} from './options.js';

type DocType = 'auto' | 'guide' | 'reference' | 'spec';

interface SummarizeToolInput extends ExtractLikeToolInput {
  markdown?: string;
  file?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  docType?: DocType;
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

const DOC_TYPE_PROMPTS: Record<DocType, string> = {
  auto: 'Summarize this markdown document. Preserve the section hierarchy, keep inline code examples verbatim, and retain all constraints, invariants, and actionable steps.',
  guide:
    'Summarize this guide or instructional document. Preserve the section hierarchy, keep all inline code and command examples verbatim, and retain step-by-step instructions and constraints.',
  reference:
    'Summarize this reference document. Preserve the section hierarchy, keep ALL code examples, type signatures, and parameter descriptions verbatim — these are the primary value of a reference doc. Omit only verbose prose.',
  spec: 'Summarize this specification. Preserve the section hierarchy, keep all constraints, invariants, formal definitions, and example values verbatim. Omit only introductory/motivational prose.',
};

function summarizePrompt(markdown: string, docType: DocType = 'auto'): SamplingMessage {
  return {
    role: 'user',
    content: {
      type: 'text',
      text: `${DOC_TYPE_PROMPTS[docType]}\n\n${markdown}`,
    },
  };
}

function getTextContent(result: CreateMessageResult): string {
  if (result.content.type !== 'text') {
    throw new Error('Sampling response was not text content.');
  }

  return result.content.text;
}

function buildSectionKey(input: SummarizeToolInput): string {
  if (!input.file) return 'inline';
  const sections = JSON.stringify([input.onlySections ?? [], input.stripSections ?? []]);
  return hashString(`${input.file}\0${sections}`);
}

export async function runSummarizeTool(
  server: McpServer,
  input: SummarizeToolInput,
): Promise<CallToolResult> {
  const markdown = await resolveMarkdown(input);
  const frontmatter = parseFrontmatter(markdown);
  const summarizeInput = buildSummarizeInput(markdown, input);
  const contentHash = hashString(summarizeInput);
  const sectionKey = buildSectionKey(input);

  const cached = getCached(sectionKey, contentHash);
  if (cached !== undefined) {
    return textResultWithFrontmatter(cached, frontmatter);
  }

  const request: CreateMessageRequestParamsBase = {
    messages: [summarizePrompt(summarizeInput, input.docType)],
    maxTokens: input.maxTokens ?? 500,
    ...(typeof input.temperature === 'number' ? { temperature: input.temperature } : {}),
    ...(input.systemPrompt ? { systemPrompt: input.systemPrompt } : {}),
  };

  try {
    const result = await server.server.createMessage(request);
    const textContent = getTextContent(result);
    setCached(sectionKey, contentHash, textContent);
    return textResultWithFrontmatter(textContent, frontmatter);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isSamplingUnavailable(message)) {
      const fallback = fallbackSummary(markdown, input);
      setCached(sectionKey, contentHash, fallback);
      return textResultWithFrontmatter(fallback, frontmatter);
    }

    throw new Error(`MCP summarize failed: ${message}`);
  }
}

export function registerSummarizeTool(server: McpServer): void {
  server.registerTool(
    'compact_md_summarize',
    {
      description:
        'Generate an abstractive summary for high-level understanding. Use for gist and onboarding; do not use when exact wording or section-accurate retrieval is required (use compact_md_extract).',
      inputSchema: {
        ...markdownOrFileSchema,
        ...summarizeLikeInputSchema,
      },
    },
    async (input) => runSummarizeTool(server, input),
  );
}
