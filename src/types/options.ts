export interface CompactOptions {
  dedup?: boolean;
  semantic?: boolean;
  keepComments?: boolean;
  onlySections?: string[];
  stripSections?: string[];
  unwrapLines?: boolean;
  tableDelimiter?: string;
  stats?: boolean;
  versionMarker?: boolean;
}

export interface ExtractOptions {
  onlySections?: string[];
  stripSections?: string[];
  maxChars?: number;
  maxListItems?: number;
  maxTableRows?: number;
}

export interface ExpandOptions {
  tableDelimiter?: string;
}
