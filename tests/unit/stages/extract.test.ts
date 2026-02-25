import { describe, expect, test } from 'bun:test';
import { extract } from '../../../src/core/extract.js';

describe('extract stage', () => {
  test('truncates long paragraph text', () => {
    const input = '# Title\n\nThis paragraph is much longer than ten characters.\n';
    const output = extract(input, { maxChars: 10 });

    expect(output).toContain('This parag ...');
  });

  test('truncates list items and appends overflow item', () => {
    const input = ['# Title', '', '- first', '- second', '- third', ''].join('\n');
    const output = extract(input, { maxListItems: 1 });

    expect(output).toContain('- first');
    expect(output).toContain('- ... 2 more items');
    expect(output).not.toContain('- third');
  });

  test('truncates table rows and appends overflow row', () => {
    const input = [
      '# Data',
      '',
      '| Name | Value |',
      '|---|---|',
      '| one | 1 |',
      '| two | 2 |',
      '| three | 3 |',
      '',
    ].join('\n');
    const output = extract(input, { maxTableRows: 1 });

    expect(output).toMatch(/\|\s*one\s*\|\s*1\s*\|/);
    expect(output).toContain('... 2 more rows');
    expect(output).not.toMatch(/\|\s*three\s*\|\s*3\s*\|/);
  });

  test('supports onlySections and stripSections filters', () => {
    const input = ['# Intro', '', 'intro text', '', '# Keep', '', 'kept text', ''].join('\n');
    const onlyOutput = extract(input, { onlySections: ['keep'] });
    const stripOutput = extract(input, { stripSections: ['intro'] });

    expect(onlyOutput).toContain('# Keep');
    expect(onlyOutput).not.toContain('# Intro');
    expect(stripOutput).toContain('# Keep');
    expect(stripOutput).not.toContain('# Intro');
  });
});
