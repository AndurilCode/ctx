import { describe, expect, test } from 'bun:test';
import { toCompactOptions, toExtractOptions } from '../../../src/mcp/tools/options.js';

describe('toCompactOptions', () => {
  test('maps all fields correctly', () => {
    const result = toCompactOptions({
      dedup: true,
      semantic: true,
      keepComments: true,
      onlySections: ['intro'],
      stripSections: ['appendix'],
      unwrapLines: true,
      tableDelimiter: '|',
      versionMarker: true,
    });

    expect(result).toEqual({
      dedup: true,
      semantic: true,
      keepComments: true,
      onlySections: ['intro'],
      stripSections: ['appendix'],
      unwrapLines: true,
      tableDelimiter: '|',
      versionMarker: true,
    });
  });

  test('passes undefined for missing fields', () => {
    const result = toCompactOptions({});
    expect(result.dedup).toBeUndefined();
    expect(result.semantic).toBeUndefined();
    expect(result.tableDelimiter).toBeUndefined();
  });
});

describe('toExtractOptions', () => {
  test('maps all fields correctly', () => {
    const result = toExtractOptions({
      onlySections: ['api'],
      stripSections: ['footer'],
      maxChars: 500,
      maxListItems: 10,
      maxTableRows: 5,
    });

    expect(result).toEqual({
      onlySections: ['api'],
      stripSections: ['footer'],
      maxChars: 500,
      maxListItems: 10,
      maxTableRows: 5,
    });
  });

  test('passes undefined for missing fields', () => {
    const result = toExtractOptions({});
    expect(result.onlySections).toBeUndefined();
    expect(result.maxChars).toBeUndefined();
  });
});
