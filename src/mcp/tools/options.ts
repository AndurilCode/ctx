import * as z from 'zod/v4';
import type { CompactOptions, ExtractOptions } from '../../types/options.js';

export interface PackLikeToolInput {
  dedup?: boolean;
  keepComments?: boolean;
  onlySections?: string[];
  semantic?: boolean;
  stripSections?: string[];
  tableDelimiter?: string;
  unwrapLines?: boolean;
  versionMarker?: boolean;
}

export function toCompactOptions(input: PackLikeToolInput): CompactOptions {
  return {
    dedup: input.dedup,
    semantic: input.semantic,
    keepComments: input.keepComments,
    onlySections: input.onlySections,
    stripSections: input.stripSections,
    unwrapLines: input.unwrapLines,
    tableDelimiter: input.tableDelimiter,
    versionMarker: input.versionMarker,
  };
}

export interface ExtractLikeToolInput {
  onlySections?: string[];
  stripSections?: string[];
  maxChars?: number;
  maxListItems?: number;
  maxTableRows?: number;
}

export function toExtractOptions(input: ExtractLikeToolInput): ExtractOptions {
  return {
    onlySections: input.onlySections,
    stripSections: input.stripSections,
    maxChars: input.maxChars,
    maxListItems: input.maxListItems,
    maxTableRows: input.maxTableRows,
  };
}

export const markdownOrFileSchema = {
  markdown: z.string().optional().describe('Markdown source text (Markdown-only).'),
  file: z.string().optional().describe('Path to a markdown file (.md/.mdx/.markdown).'),
};

export const codeOrFileSchema = {
  code: z.string().optional(),
  file: z.string().optional(),
};

export const packLikeInputSchema = {
  ...markdownOrFileSchema,
  dedup: z.boolean().optional(),
  semantic: z.boolean().optional(),
  keepComments: z.boolean().optional(),
  onlySections: z.array(z.string()).optional(),
  stripSections: z.array(z.string()).optional(),
  unwrapLines: z.boolean().optional(),
  tableDelimiter: z.string().optional(),
  versionMarker: z.boolean().optional(),
};

export const summarizeLikeInputSchema = {
  onlySections: z.array(z.string()).optional(),
  stripSections: z.array(z.string()).optional(),
  maxTokens: z.number().optional(),
  temperature: z.number().optional(),
  systemPrompt: z.string().optional(),
  docType: z
    .enum(['auto', 'guide', 'reference', 'spec'])
    .optional()
    .describe(
      'auto (default) — balanced; guide — step-by-step docs, preserves commands; reference — API/type docs, preserves all code verbatim; spec — formal specs, preserves invariants',
    ),
};

export const diffInputSchema = {
  diff: z.string().optional(),
  file: z.string().optional(),
  context: z.number().int().min(0).optional(),
  compactHeaders: z.boolean().optional(),
  changesOnly: z.boolean().optional(),
};

export const pruneLogInputSchema = {
  log: z.string().optional(),
  file: z.string().optional(),
  profile: z.enum(['test', 'ci', 'lint', 'runtime']).optional(),
  stripTimestamps: z.enum(['auto', 'strip', 'keep']).optional(),
  foldProgress: z.boolean().optional(),
  elidePassingTests: z.boolean().optional(),
  foldDebugLines: z.boolean().optional(),
  elideHealthChecks: z.boolean().optional(),
  foldJsonLines: z.boolean().optional(),
  foldFrameworkStartup: z.boolean().optional(),
  stripUserAgents: z.boolean().optional(),
  dedupeStackTraces: z.boolean().optional(),
  foldRepeatedLines: z.boolean().optional(),
  foldGlobalRepeats: z.boolean().optional(),
  allowTokenExpansion: z.boolean().optional(),
  thresholdTokens: z.number().int().min(0).optional(),
  summarizeIfOverThreshold: z.boolean().optional(),
  maxSummaryTokens: z.number().int().min(64).max(4096).optional(),
  customRules: z
    .array(
      z.union([
        z.object({
          type: z.literal('strip'),
          pattern: z.string(),
        }),
        z.object({
          type: z.literal('fold'),
          pattern: z.string(),
          label: z.string().optional(),
        }),
        z.object({
          type: z.literal('block'),
          start: z.string(),
          end: z.string(),
          label: z.string().optional(),
        }),
      ]),
    )
    .optional(),
};
