import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';
import type { CompactOptions } from '../../types/options.js';
import { createStage } from '../stage.js';
import { buildDedupDictionary, setDedupDictionary } from './dictionary.js';
import { applyDedupReplacements } from './replacer.js';
import { scanDedupCandidates } from './scanner.js';

function collectTextValues(tree: Root): string[] {
  const values: string[] = [];

  visit(tree, (node) => {
    if (node.type !== 'text' && node.type !== 'code' && node.type !== 'html') {
      return;
    }

    if (!('value' in node) || typeof node.value !== 'string') {
      return;
    }

    values.push(node.value);
  });

  return values;
}

function runDedupTransform(tree: Root, _options: CompactOptions): Root {
  const sourceValues = collectTextValues(tree);
  if (sourceValues.length === 0) {
    return tree;
  }

  const candidates = scanDedupCandidates(sourceValues);
  const dictionary = buildDedupDictionary(candidates, sourceValues.join('\n'));
  if (dictionary.length === 0) {
    return tree;
  }

  const replaced = applyDedupReplacements(tree, dictionary);
  setDedupDictionary(replaced, dictionary);
  return replaced;
}

export const dedupStage = createStage({
  name: 'dedup',
  enabled: (options) => options.dedup === true,
  transform: runDedupTransform,
});
