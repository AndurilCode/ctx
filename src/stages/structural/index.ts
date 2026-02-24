import type { Root } from 'mdast';
import type { CompactOptions } from '../../types/options.js';
import { createStage } from '../stage.js';
import { transformCodeBlocks } from './code-blocks.js';
import { transformHeadings } from './headings.js';
import { transformHorizontalRules } from './horizontal-rules.js';
import { transformLists } from './lists.js';
import { transformTables } from './tables.js';
import { transformTaskLists } from './task-lists.js';

function runStructuralTransforms(tree: Root, options: CompactOptions): Root {
  const withHeadings = transformHeadings(tree, options);
  const withTables = transformTables(withHeadings, options);
  const withLists = transformLists(withTables, options);
  const withCodeBlocks = transformCodeBlocks(withLists, options);
  const withTaskLists = transformTaskLists(withCodeBlocks, options);
  return transformHorizontalRules(withTaskLists, options);
}

export const structuralStage = createStage({
  name: 'structural',
  enabled: () => true,
  transform: runStructuralTransforms,
});
