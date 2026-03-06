import { describe, expect, test } from 'bun:test';
import { classifyTool, normalizeArgs, buildRequest } from '../../../../src/core/harness/normalize.js';

describe('classifyTool', () => {
  test('maps Read to read class', () => expect(classifyTool('Read')).toBe('read'));
  test('maps Grep to search class', () => expect(classifyTool('Grep')).toBe('search'));
  test('maps Glob to list class', () => expect(classifyTool('Glob')).toBe('list'));
  test('maps Edit to mutate class', () => expect(classifyTool('Edit')).toBe('mutate'));
  test('maps Write to mutate class', () => expect(classifyTool('Write')).toBe('mutate'));
  test('maps Bash to execute class', () => expect(classifyTool('Bash')).toBe('execute'));
  test('unknown tool returns execute', () => expect(classifyTool('SomethingElse')).toBe('execute'));
  test('maps lowercase read', () => expect(classifyTool('read')).toBe('read'));
  test('maps ctx gather to search', () => expect(classifyTool('gather')).toBe('search'));
  test('maps ctx outline to read', () => expect(classifyTool('outline')).toBe('read'));
  test('maps ctx patch to mutate', () => expect(classifyTool('patch')).toBe('mutate'));
  test('maps context to context', () => expect(classifyTool('context')).toBe('context'));
});

describe('normalizeArgs', () => {
  test('normalizes file_path to file', () => {
    const result = normalizeArgs({ file_path: '/src/foo.ts', maxTokens: 1000 });
    expect(result.file).toBe('/src/foo.ts');
    expect(result.file_path).toBe('/src/foo.ts');
  });

  test('preserves file if already set', () => {
    const result = normalizeArgs({ file: '/src/bar.ts' });
    expect(result.file).toBe('/src/bar.ts');
  });

  test('does not overwrite existing file with file_path', () => {
    const result = normalizeArgs({ file: '/a.ts', file_path: '/b.ts' });
    expect(result.file).toBe('/a.ts');
  });
});

describe('buildRequest', () => {
  test('builds a HarnessRequest from hook inputs', () => {
    const req = buildRequest({
      surface: 'claude-hook',
      event: 'PreToolUse',
      toolName: 'Read',
      toolInput: { file_path: '/src/foo.ts' },
      rawPath: '/src/foo.ts',
    });
    expect(req.surface).toBe('claude-hook');
    expect(req.toolClass).toBe('read');
    expect(req.toolName).toBe('Read');
    expect(req.args.file).toBe('/src/foo.ts');
    expect(req.capabilities.canInjectContext).toBe(true);
    expect(req.capabilities.canRewrite).toBe(false);
  });

  test('mcp surface has full capabilities', () => {
    const req = buildRequest({
      surface: 'mcp',
      event: 'PreToolUse',
      toolName: 'Read',
      toolInput: {},
    });
    expect(req.capabilities.canRewrite).toBe(true);
    expect(req.capabilities.canReturnCached).toBe(true);
  });
});
