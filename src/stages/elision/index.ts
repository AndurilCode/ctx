import type { Root } from 'mdast';
import type { CompactOptions } from '../../types/options.js';
import { type HeadingRange, buildHeadingRanges } from '../../utils/headings.js';
import { containsSectionQuery, normalizeSectionQuery } from '../../utils/text.js';
import { createStage } from '../stage.js';

function normalizeFilters(filters: string[] | undefined): string[] {
  if (!filters) {
    return [];
  }

  return filters
    .map((filter) => normalizeSectionQuery(filter))
    .filter((filter) => filter.length > 0);
}

function isIndexInside(index: number, ranges: readonly HeadingRange[]): boolean {
  return ranges.some((range) => index >= range.start && index < range.end);
}

function runElisionTransform(tree: Root, options: CompactOptions): Root {
  const onlyFilters = normalizeFilters(options.onlySections);
  const stripFilters = normalizeFilters(options.stripSections);

  if (onlyFilters.length > 0 && stripFilters.length > 0) {
    throw new Error('onlySections and stripSections are mutually exclusive.');
  }

  if (onlyFilters.length === 0 && stripFilters.length === 0) {
    return tree;
  }

  const ranges = buildHeadingRanges(tree);
  if (ranges.length === 0) {
    return tree;
  }

  if (onlyFilters.length > 0) {
    const included = ranges.filter((range) => containsSectionQuery(range.text, onlyFilters));
    tree.children = tree.children.filter((_, index) => isIndexInside(index, included));
    return tree;
  }

  const excluded = ranges.filter((range) => containsSectionQuery(range.text, stripFilters));
  tree.children = tree.children.filter((_, index) => !isIndexInside(index, excluded));
  return tree;
}

export const elisionStage = createStage({
  name: 'elision',
  enabled: (options) =>
    (options.onlySections?.length ?? 0) > 0 || (options.stripSections?.length ?? 0) > 0,
  transform: runElisionTransform,
});
