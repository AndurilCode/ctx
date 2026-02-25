import { describe, expect, test } from 'bun:test';
import { parseFrontmatter } from '../../../src/utils/frontmatter.js';

describe('parseFrontmatter', () => {
  test('returns empty object when frontmatter is absent', () => {
    const markdown = '# Title\n\nBody\n';
    expect(parseFrontmatter(markdown)).toEqual({});
  });

  test('parses scalar values and inline arrays', () => {
    const markdown = [
      '---',
      'title: Compact Docs',
      'count: 3',
      'enabled: true',
      'draft: false',
      'empty: null',
      'tags: [alpha, beta, gamma]',
      '---',
      '# Title',
      '',
    ].join('\n');

    expect(parseFrontmatter(markdown)).toEqual({
      title: 'Compact Docs',
      count: 3,
      enabled: true,
      draft: false,
      empty: null,
      tags: ['alpha', 'beta', 'gamma'],
    });
  });

  test('parses quoted strings', () => {
    const markdown = [
      '---',
      'title: "Compact: Project"',
      "subtitle: 'Token efficient'",
      '---',
      '# Intro',
      '',
    ].join('\n');

    expect(parseFrontmatter(markdown)).toEqual({
      title: 'Compact: Project',
      subtitle: 'Token efficient',
    });
  });

  test('returns empty object for malformed frontmatter', () => {
    const markdown = ['---', 'title Compact', '---', '# Intro', ''].join('\n');
    expect(parseFrontmatter(markdown)).toEqual({});
  });
});
