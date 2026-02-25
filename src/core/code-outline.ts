import { parseOutline, resolveDisplayPath } from '../parser/code-outline.js';
import type { OutlineOptions, OutlineResult } from '../types/outline.js';
import { formatOutlineOutput } from './outline-format.js';

function countLines(text: string): number {
  if (text.length === 0) return 0;
  return text.split('\n').length;
}

export async function codeOutline(
  code: string,
  options: OutlineOptions = {},
): Promise<OutlineResult> {
  const parsed = await parseOutline(code, options);
  const totalLines = countLines(code);
  const output = formatOutlineOutput({
    pathLabel: resolveDisplayPath(options.filePath),
    language: parsed.language,
    totalLines,
    nodes: parsed.nodes,
    depth: options.depth,
    collapseImports: options.collapseImports,
  });
  return {
    nodes: parsed.nodes,
    language: parsed.language,
    totalLines,
    output,
  };
}
