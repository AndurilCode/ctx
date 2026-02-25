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
