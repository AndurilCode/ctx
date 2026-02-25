import { describe, expect, test } from 'bun:test';
import { createPipeline } from '../../../src/core/create-pipeline.js';
import type { Stage } from '../../../src/stages/stage.js';

describe('createPipeline', () => {
  test('returns a runner that applies stages and serializes to compact', () => {
    const pipeline = createPipeline([]);
    const result = pipeline.run('# Hello\n\nWorld\n');
    expect(result).toContain('Hello');
  });

  test('applies provided stages', () => {
    const calls: string[] = [];
    const stage: Stage = {
      name: 'tracker',
      enabled: () => true,
      transform: (tree) => {
        calls.push('ran');
        return tree;
      },
    };

    const pipeline = createPipeline([stage]);
    pipeline.run('# Hello\n');
    expect(calls).toEqual(['ran']);
  });

  test('skips disabled stages', () => {
    const calls: string[] = [];
    const stage: Stage = {
      name: 'disabled',
      enabled: () => false,
      transform: (tree) => {
        calls.push('ran');
        return tree;
      },
    };

    const pipeline = createPipeline([stage]);
    pipeline.run('# Hello\n');
    expect(calls).toEqual([]);
  });

  test('accepts optional options', () => {
    const pipeline = createPipeline([]);
    expect(() => pipeline.run('# Hello\n', { tableDelimiter: '|' })).not.toThrow();
  });
});
