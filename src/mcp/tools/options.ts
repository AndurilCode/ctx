import type { CompactOptions } from '../../types/options.js';

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
