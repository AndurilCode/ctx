import { describe, expect, test } from 'bun:test';
import { registerCompactMdTools } from '../../../src/mcp/tools/index.js';

describe('MCP tool surface', () => {
  test('registered tool count is at most 15', () => {
    const registered: string[] = [];
    const fakeServer = {
      registerTool: (name: string) => { registered.push(name); },
    };
    registerCompactMdTools(fakeServer as any);
    expect(registered.length).toBeLessThanOrEqual(15);
    expect(registered).not.toContain('compact_md_verify');
    expect(registered).not.toContain('compact_md_metrics');
    expect(registered).not.toContain('compact_md_tokens');
    expect(registered).not.toContain('compact_md_locate');
    expect(registered).not.toContain('compact_md_summarize');
    expect(registered).not.toContain('compact_md_batch');
  });
});
