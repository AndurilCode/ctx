import { resolve } from 'node:path';
import type { ReadOptions, ReadResult, ReadStrategy } from '../types/read.js';
import { readFileText } from '../utils/file-reader.js';
import type { TokenCounter } from '../utils/tokens.js';
import { createTokenCounter } from '../utils/tokens.js';

export async function budgetedRead(options: ReadOptions): Promise<ReadResult> {
  const content = options.content ?? (await readFileText(resolve(options.file)));
  const counter = await createTokenCounter();
  const totalTokens = options.totalTokens ?? counter.count(content);

  if (!options.maxTokens || totalTokens <= options.maxTokens) {
    return {
      content,
      strategy: 'full',
      totalTokens,
      returnedTokens: totalTokens,
      truncated: false,
    };
  }

  const strategy = options.strategy ?? 'auto';

  if (strategy === 'auto') {
    return runAutoStrategy(content, options.file, options.maxTokens, totalTokens, counter);
  }

  return applyStrategy(strategy, content, options.file, options.maxTokens, totalTokens, counter);
}

async function runAutoStrategy(
  content: string,
  file: string,
  maxTokens: number,
  totalTokens: number,
  counter: TokenCounter,
): Promise<ReadResult> {
  if (isCodeFile(file)) {
    try {
      const result = await applyStrategy('outline', content, file, maxTokens, totalTokens, counter);
      if (result.returnedTokens <= maxTokens) return result;
    } catch {
      // outline not available for this language — fall through
    }
  }

  if (isMarkdownFile(file)) {
    try {
      const result = await applyStrategy(
        'sections',
        content,
        file,
        maxTokens,
        totalTokens,
        counter,
      );
      if (result.returnedTokens <= maxTokens) return result;
    } catch {
      // fall through
    }
  }

  return applyStrategy('truncate', content, file, maxTokens, totalTokens, counter);
}

async function applyStrategy(
  strategy: ReadStrategy,
  content: string,
  file: string,
  maxTokens: number,
  totalTokens: number,
  counter: TokenCounter,
): Promise<ReadResult> {
  if (strategy === 'outline') {
    const { codeOutline } = await import('./code-outline.js');
    const result = await codeOutline(content, { filePath: file });
    const tokens = counter.count(result.output);
    return {
      content: result.output,
      strategy: 'outline',
      totalTokens,
      returnedTokens: tokens,
      truncated: true,
    };
  }

  if (strategy === 'sections') {
    const { extract } = await import('./extract.js');
    const output = extract(content, { maxChars: maxTokens * 4 });
    const tokens = counter.count(output);
    return {
      content: output,
      strategy: 'sections',
      totalTokens,
      returnedTokens: tokens,
      truncated: true,
    };
  }

  // Default: truncate
  const truncated = truncateToTokenBudget(content, maxTokens, counter);
  const tokens = counter.count(truncated);
  return {
    content: truncated,
    strategy: 'truncate',
    totalTokens,
    returnedTokens: tokens,
    truncated: true,
  };
}

function truncateToTokenBudget(content: string, maxTokens: number, counter: TokenCounter): string {
  const lines = content.split('\n');
  let lo = 0;
  let hi = lines.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    const slice = lines.slice(0, mid).join('\n');
    if (counter.count(slice) <= maxTokens - 5) lo = mid;
    else hi = mid - 1;
  }
  const kept = lines.slice(0, lo).join('\n');
  const remaining = counter.count(content) - counter.count(kept);
  return `${kept}\n[...truncated, ~${remaining} more tokens]`;
}

function isCodeFile(path: string): boolean {
  return /\.(ts|js|tsx|jsx|py|rs|go|java|c|cpp|rb|swift|kt|sh|yaml|yml|json|toml|css|scss)$/.test(
    path,
  );
}

function isMarkdownFile(path: string): boolean {
  return /\.(md|mdx|markdown)$/.test(path);
}
