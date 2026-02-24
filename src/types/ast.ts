import type { Root } from 'mdast';

export type CompactRoot = Root;

export interface CompactHeading {
  kind: 'heading';
  depth: number;
  value: string;
}

export interface CompactTable {
  kind: 'table';
  header: string[];
  rows: string[][];
}

export interface CompactListItem {
  kind: 'list-item';
  ordered: boolean;
  depth: number;
  checked?: boolean;
  value: string;
}

export interface CompactCodeBlock {
  kind: 'code';
  lang?: string;
  value: string;
}

export interface CompactThematicBreak {
  kind: 'hr';
}

export type CompactNode =
  | CompactHeading
  | CompactTable
  | CompactListItem
  | CompactCodeBlock
  | CompactThematicBreak;

declare module 'mdast' {
  interface CodeData {
    compactCodeFence?: boolean;
  }

  interface HeadingData {
    compactHeading?: string;
  }

  interface ListItemData {
    compactDepth?: number;
    compactPrefix?: string;
    compactTask?: boolean;
  }

  interface RootData {
    order?: string[];
  }

  interface TableData {
    compactTable?: boolean;
  }

  interface ThematicBreakData {
    compactThematicBreak?: string;
  }
}
