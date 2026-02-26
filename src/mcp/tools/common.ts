import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { readFileText } from '../../utils/file-reader.js';

export function textResult(text: string): CallToolResult {
  return {
    content: [{ type: 'text', text }],
  };
}

export function textResultWithFrontmatter(
  text: string,
  frontmatter: Record<string, unknown>,
): CallToolResult {
  return {
    content: [
      { type: 'text', text },
      { type: 'text', text: JSON.stringify({ frontmatter }, null, 2) },
    ],
  };
}

export function jsonResult(payload: unknown): CallToolResult {
  return textResult(JSON.stringify(payload, null, 2));
}

export async function resolveMarkdown(input: {
  markdown?: string;
  file?: string;
}): Promise<string> {
  if (input.file) {
    return readFileText(input.file);
  }

  if (input.markdown) {
    return input.markdown;
  }

  throw new Error('Either markdown or file must be provided.');
}

export async function resolveTextInput(input: {
  text?: string;
  file?: string;
}): Promise<string> {
  if (input.file) {
    return readFileText(input.file);
  }

  if (input.text) {
    return input.text;
  }

  throw new Error('Either text or file must be provided.');
}
