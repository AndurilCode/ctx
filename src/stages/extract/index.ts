import type { Root } from 'mdast';
import type { CompactOptions, ExtractOptions } from '../../types/options.js';
import { createStage } from '../stage.js';
import { extractListStage } from './list.js';
import { extractParagraphStage } from './paragraph.js';
import { extractTableStage } from './table.js';

function runExtractTransforms(tree: Root, options: CompactOptions): Root {
  const extractOptions = options as ExtractOptions;
  const paragraphs = extractParagraphStage(tree, extractOptions);
  const lists = extractListStage(paragraphs, extractOptions);
  return extractTableStage(lists, extractOptions);
}

export const extractStage = createStage({
  name: 'extract',
  enabled: () => true,
  transform: runExtractTransforms,
});
