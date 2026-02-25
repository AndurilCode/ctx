import type { TokenCountOptions, TokenCountResult } from '../types/token-count.js';
import { readFileText } from '../utils/file-reader.js';
import { createTokenCounter } from '../utils/tokens.js';

export async function tokenCount(options: TokenCountOptions = {}): Promise<TokenCountResult> {
  let content: string;
  if (options.file) {
    content = await readFileText(options.file);
  } else if (options.text !== undefined) {
    content = options.text;
  } else {
    throw new Error('Either text or file must be provided.');
  }

  const counter = await createTokenCounter();
  return {
    tokens: counter.count(content),
    bytes: Buffer.byteLength(content, 'utf8'),
    lines: content.split('\n').length,
  };
}
