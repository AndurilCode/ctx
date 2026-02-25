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
  markdown: z.string().optional(),
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
