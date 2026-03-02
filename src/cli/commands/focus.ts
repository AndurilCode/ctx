import { defineCommand } from 'citty';
import { focus } from '../../core/focus.js';
import type { FocusSection } from '../../types/focus.js';

function parseTarget(input: string): { file: string; symbol: string } {
  const idx = input.lastIndexOf('::');
  if (idx <= 0 || idx >= input.length - 2) {
    throw new Error('Target must use the format <file>::<symbol>.');
  }
  return {
    file: input.slice(0, idx),
    symbol: input.slice(idx + 2),
  };
}

export const focusCommand = defineCommand({
  meta: {
    name: 'focus',
    description: 'Assemble full symbol context (body, callers, deps, types, tests, conventions).',
  },
  args: {
    target: {
      type: 'positional',
      required: true,
      description: 'Symbol target in the form <file>::<symbol>.',
    },
    hash: {
      type: 'string',
      required: false,
      description: 'Optional symbol hash from ctx outline.',
    },
    maxTokens: {
      type: 'string',
      required: false,
      default: '2000',
      description: 'Token budget for output sections.',
    },
    depth: {
      type: 'string',
      required: false,
      default: '1',
      description: 'Reserved for caller/dependency expansion depth.',
    },
    include: {
      type: 'string',
      required: false,
      description:
        'Comma-separated sections: body,callers,deps,types,tests,conventions (default: all).',
    },
  },
  async run({ args }) {
    const target = parseTarget(String(args.target));
    const include = args.include
      ? (String(args.include)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean) as FocusSection[])
      : undefined;
    const result = await focus({
      file: target.file,
      symbol: target.symbol,
      hash: args.hash ? String(args.hash) : undefined,
      maxTokens: Number(args.maxTokens),
      depth: Number(args.depth),
      include,
    });
    process.stdout.write(result.output);
    process.stdout.write('\n');
  },
});
