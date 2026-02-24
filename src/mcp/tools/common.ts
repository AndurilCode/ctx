import { readFile } from 'node:fs/promises';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export function textResult(text: string): CallToolResult {
  return {
    content: [{ type: 'text', text }],
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
    return readFile(input.file, 'utf8');
  }

  if (input.markdown) {
    return input.markdown;
  }

  throw new Error('Either markdown or file must be provided.');
}
