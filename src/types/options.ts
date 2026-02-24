export interface CompactOptions {
  dedup?: boolean;
  semantic?: boolean;
  keepComments?: boolean;
  tableDelimiter?: string;
  stats?: boolean;
  versionMarker?: boolean;
}

export interface ExpandOptions {
  tableDelimiter?: string;
}
