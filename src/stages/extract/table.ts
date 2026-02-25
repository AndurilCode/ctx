import type { Root, TableCell, TableRow, Text } from 'mdast';
import { visit } from 'unist-util-visit';
import type { ExtractOptions } from '../../types/options.js';
import { formatExtractOverflow, normalizeExtractLimit } from '../../utils/text.js';

const DEFAULT_MAX_TABLE_ROWS = 2;

function resolveMaxTableRows(options: ExtractOptions): number {
  return normalizeExtractLimit(options.maxTableRows, DEFAULT_MAX_TABLE_ROWS);
}

function createOverflowTableRow(hiddenCount: number, columnCount: number): TableRow {
  const firstCellText: Text = {
    type: 'text',
    value: formatExtractOverflow('rows', hiddenCount),
  };
  const firstCell: TableCell = {
    type: 'tableCell',
    children: [firstCellText],
  };
  const fillerCells: TableCell[] = Array.from(
    { length: Math.max(0, columnCount - 1) },
    (): TableCell => ({
      type: 'tableCell',
      children: [{ type: 'text', value: '' }],
    }),
  );

  return {
    type: 'tableRow',
    children: [firstCell, ...fillerCells],
  };
}

export function extractTableStage(tree: Root, options: ExtractOptions): Root {
  const maxRows = resolveMaxTableRows(options);

  visit(tree, 'table', (node) => {
    const [header, ...dataRows] = node.children;
    if (!header || dataRows.length <= maxRows) {
      return;
    }

    const keptRows = dataRows.slice(0, maxRows);
    const hiddenCount = dataRows.length - maxRows;
    const overflow = createOverflowTableRow(hiddenCount, header.children.length);
    node.children = [header, ...keptRows, overflow];
  });

  return tree;
}
