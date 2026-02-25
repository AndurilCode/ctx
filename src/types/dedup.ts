import type { Root } from 'mdast';

export interface DedupEntry {
  token: string;
  value: string;
}

export type RootWithDedupData = Root & {
  data?: {
    compactDedupDictionary?: DedupEntry[];
  };
};
