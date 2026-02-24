import type { Root } from 'mdast';
import { describe, expect, test } from 'vitest';
import { runPipeline } from '../../../src/core/pipeline.js';
import type { Stage } from '../../../src/stages/stage.js';

describe('runPipeline', () => {
  test('applies enabled stages in order', () => {
    const tree: Root = { type: 'root', children: [] };

    const stageA: Stage = {
      name: 'a',
      enabled: () => true,
      transform: (input) => {
        if (!input.data) {
          input.data = {};
        }

        input.data.order = ['a'];
        return input;
      },
    };

    const stageB: Stage = {
      name: 'b',
      enabled: () => true,
      transform: (input) => {
        if (!input.data) {
          input.data = {};
        }

        const order = (input.data.order ?? []) as string[];
        order.push('b');
        input.data = { ...input.data, order };
        return input;
      },
    };

    const result = runPipeline(tree, [stageA, stageB], {});
    expect(result.data?.order).toEqual(['a', 'b']);
  });
});
