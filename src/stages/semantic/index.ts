import type { Root } from 'mdast';
import type { CompactOptions } from '../../types/options.js';
import { createStage } from '../stage.js';
import { cleanupSemanticTransform } from './cleanup.js';
import { stripCommentsTransform } from './comments.js';
import { normalizeTextTransform } from './normalize.js';

function runSemanticTransforms(tree: Root, options: CompactOptions): Root {
  const withoutComments = stripCommentsTransform(tree, options);
  const normalized = normalizeTextTransform(withoutComments, options);
  return cleanupSemanticTransform(normalized, options);
}

export const semanticStage = createStage({
  name: 'semantic',
  enabled: (options) => options.semantic === true,
  transform: runSemanticTransforms,
});
