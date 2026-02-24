export interface TokenCounter {
  count(input: string): number;
}

class FallbackTokenCounter implements TokenCounter {
  count(input: string): number {
    const normalized = input.trim();
    if (!normalized) {
      return 0;
    }

    // Conservative approximation when tokenizer is unavailable.
    return normalized.split(/\s+/).length;
  }
}

let cachedCounter: TokenCounter | undefined;

export async function createTokenCounter(): Promise<TokenCounter> {
  if (cachedCounter) {
    return cachedCounter;
  }

  try {
    const mod = await import('tiktoken');
    const encoder = mod.get_encoding('cl100k_base');
    cachedCounter = {
      count(input: string): number {
        const encoded = encoder.encode(input);
        return encoded.length;
      },
    };
  } catch {
    cachedCounter = new FallbackTokenCounter();
  }

  return cachedCounter;
}

export function createFallbackTokenCounter(): TokenCounter {
  return new FallbackTokenCounter();
}
