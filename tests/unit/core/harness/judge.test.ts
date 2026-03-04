import { describe, expect, test } from 'bun:test';
import { buildJudgePrompt, parseJudgeResponse, evaluateWithJudge } from '../../../../src/core/harness/judge.js';

describe('buildJudgePrompt', () => {
  test('includes tool, task, cache summary, and alternatives', () => {
    const prompt = buildJudgePrompt({
      tool: 'read',
      args: { file: 'auth.ts' },
      taskDescription: 'fix token expiry bug',
      cacheSummary: 'auth.ts outline (150 tokens, turn 2)',
      alternatives: [
        { tool: 'outline', args: { file: 'auth.ts' }, estTokens: 150, roundtrips: 1, cost: 90 },
        { tool: 'read', args: { file: 'auth.ts', maxTokens: 800 }, estTokens: 800, roundtrips: 1, cost: 480 },
      ],
    });
    expect(prompt).toContain('read');
    expect(prompt).toContain('auth.ts');
    expect(prompt).toContain('fix token expiry bug');
    expect(prompt).toContain('outline');
  });

  test('formats alternatives with numbering and cost', () => {
    const prompt = buildJudgePrompt({
      tool: 'read',
      args: { file: 'main.ts' },
      taskDescription: 'understand entry point',
      cacheSummary: 'nothing read yet',
      alternatives: [
        { tool: 'outline', args: { file: 'main.ts' }, estTokens: 100, roundtrips: 1, cost: 60 },
      ],
    });
    expect(prompt).toContain('1. outline');
    expect(prompt).toContain('~100 tokens');
    expect(prompt).toContain('cost=60');
  });

  test('includes response instructions', () => {
    const prompt = buildJudgePrompt({
      tool: 'read',
      args: { file: 'x.ts' },
      taskDescription: 'test',
      cacheSummary: '',
      alternatives: [],
    });
    expect(prompt).toContain('ALLOW');
    expect(prompt).toContain('REWRITE');
    expect(prompt).toContain('minimum cost');
  });
});

describe('parseJudgeResponse', () => {
  test('parses allow response', () => {
    const result = parseJudgeResponse('ALLOW');
    expect(result.outcome).toBe('allow');
  });

  test('parses rewrite response with tool and args', () => {
    const result = parseJudgeResponse('REWRITE: read(file="auth.ts", maxTokens=800)');
    expect(result.outcome).toBe('rewrite');
    if (result.outcome === 'rewrite') {
      expect(result.tool).toBe('read');
      expect(result.args.file).toBe('auth.ts');
      expect(result.args.maxTokens).toBe(800);
    }
  });

  test('parses rewrite with single-quoted values', () => {
    const result = parseJudgeResponse("REWRITE: outline(file='src/index.ts')");
    expect(result.outcome).toBe('rewrite');
    if (result.outcome === 'rewrite') {
      expect(result.tool).toBe('outline');
      expect(result.args.file).toBe('src/index.ts');
    }
  });

  test('parses rewrite with no args', () => {
    const result = parseJudgeResponse('REWRITE: status()');
    expect(result.outcome).toBe('rewrite');
    if (result.outcome === 'rewrite') {
      expect(result.tool).toBe('status');
      expect(result.args).toEqual({});
    }
  });

  test('falls back to allow on unparseable response', () => {
    const result = parseJudgeResponse('I think maybe you should...');
    expect(result.outcome).toBe('allow');
  });

  test('falls back to allow on empty response', () => {
    const result = parseJudgeResponse('');
    expect(result.outcome).toBe('allow');
  });

  test('handles whitespace around response', () => {
    const result = parseJudgeResponse('  ALLOW  ');
    expect(result.outcome).toBe('allow');
  });
});

describe('evaluateWithJudge', () => {
  test('returns allow when llm responds ALLOW', async () => {
    const result = await evaluateWithJudge(
      { tool: 'read', args: { file: 'x.ts' } },
      {
        taskDescription: 'test task',
        cacheSummary: 'empty',
        alternatives: [],
      },
      async () => 'ALLOW',
    );
    expect(result.outcome).toBe('allow');
  });

  test('returns rewrite when llm responds with REWRITE', async () => {
    const result = await evaluateWithJudge(
      { tool: 'read', args: { file: 'x.ts' } },
      {
        taskDescription: 'test task',
        cacheSummary: 'empty',
        alternatives: [
          { tool: 'outline', args: { file: 'x.ts' }, estTokens: 100, roundtrips: 1, cost: 60 },
        ],
      },
      async () => 'REWRITE: outline(file="x.ts")',
    );
    expect(result.outcome).toBe('rewrite');
    if (result.outcome === 'rewrite') {
      expect(result.tool).toBe('outline');
      expect(result.args.file).toBe('x.ts');
    }
  });

  test('falls back to allow on llmCall error', async () => {
    const result = await evaluateWithJudge(
      { tool: 'read', args: { file: 'x.ts' } },
      {
        taskDescription: 'test task',
        cacheSummary: 'empty',
        alternatives: [],
      },
      async () => {
        throw new Error('LLM unavailable');
      },
    );
    expect(result.outcome).toBe('allow');
  });

  test('passes correct prompt to llmCall', async () => {
    let capturedPrompt = '';
    await evaluateWithJudge(
      { tool: 'read', args: { file: 'auth.ts' } },
      {
        taskDescription: 'fix bug',
        cacheSummary: 'auth.ts seen',
        alternatives: [],
      },
      async (prompt) => {
        capturedPrompt = prompt;
        return 'ALLOW';
      },
    );
    expect(capturedPrompt).toContain('read');
    expect(capturedPrompt).toContain('auth.ts');
    expect(capturedPrompt).toContain('fix bug');
    expect(capturedPrompt).toContain('auth.ts seen');
  });
});
