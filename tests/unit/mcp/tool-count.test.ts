import { describe, expect, test } from 'bun:test';
import { registerCompactMdTools } from '../../../src/mcp/tools/index.js';

describe('MCP tool surface', () => {
  test('registered tool count is at most 17', () => {
    const registered: string[] = [];
    const fakeServer = {
      registerTool: (name: string) => { registered.push(name); },
    };
    registerCompactMdTools(fakeServer as any);
    expect(registered.length).toBeLessThanOrEqual(17);
    expect(registered).not.toContain('compact_md_verify');
    expect(registered).not.toContain('compact_md_metrics');
    expect(registered).not.toContain('compact_md_tokens');
    expect(registered).not.toContain('compact_md_locate');
  });
});
