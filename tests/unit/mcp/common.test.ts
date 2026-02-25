import { describe, expect, test } from 'bun:test';
import {
  jsonResult,
  textResult,
  textResultWithFrontmatter,
} from '../../../src/mcp/tools/common.js';

describe('textResult', () => {
  test('wraps text in content array', () => {
    const result = textResult('hello');
    expect(result.content).toEqual([{ type: 'text', text: 'hello' }]);
  });

  test('handles empty string', () => {
    const result = textResult('');
    expect(result.content).toEqual([{ type: 'text', text: '' }]);
  });
});

describe('textResultWithFrontmatter', () => {
  test('returns two content items: text and frontmatter JSON', () => {
    const result = textResultWithFrontmatter('body', { title: 'Hello' });
    expect(result.content).toHaveLength(2);
    expect(result.content[0]).toEqual({ type: 'text', text: 'body' });
    const meta = JSON.parse((result.content[1] as { type: string; text: string }).text);
    expect(meta.frontmatter).toEqual({ title: 'Hello' });
  });

  test('handles empty frontmatter', () => {
    const result = textResultWithFrontmatter('body', {});
    const meta = JSON.parse((result.content[1] as { type: string; text: string }).text);
    expect(meta.frontmatter).toEqual({});
  });
});

describe('jsonResult', () => {
  test('serializes payload to pretty JSON text', () => {
    const result = jsonResult({ key: 'value' });
    expect(result.content).toHaveLength(1);
    const parsed = JSON.parse((result.content[0] as { type: string; text: string }).text);
    expect(parsed).toEqual({ key: 'value' });
  });
});
