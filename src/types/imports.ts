export interface ImportsOptions {
  file: string;
  direction?: 'both' | 'incoming' | 'outgoing';
  depth?: number;
  root?: string;
}

export interface ImportEdge {
  specifier: string;
  resolved: string;
}

export interface ImportsResult {
  file: string;
  outgoing: ImportEdge[];
  incoming: string[];
  output: string;
}
