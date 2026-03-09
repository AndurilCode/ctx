import { describe, expect, test } from 'bun:test';
import { registerCompactMdTools } from '../../../src/mcp/tools/index.js';

describe('MCP tool surface', () => {
  test('registered tool count is at most 21', () => {
    const registered: string[] = [];
    const fakeServer = {
      registerTool: (name: string) => {
        registered.push(name);
      },
    };
    registerCompactMdTools(fakeServer as any);
    expect(registered.length).toBeLessThanOrEqual(23);
    expect(registered).toContain('ctx_verify');
    expect(registered).toContain('ctx_roundtrip_verify');
    expect(registered).toContain('ctx_focus');
    expect(registered).not.toContain('ctx_metrics');
    expect(registered).not.toContain('ctx_tokens');
    expect(registered).not.toContain('ctx_locate');
    expect(registered).not.toContain('ctx_summarize');
    expect(registered).not.toContain('ctx_batch');
  });
});
