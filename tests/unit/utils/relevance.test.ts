import { describe, expect, test } from 'bun:test';
import { queryTerms } from '../../../src/utils/relevance.js';

describe('queryTerms', () => {
  test('splits camelCase into parts', () => {
    expect(queryTerms('autoContext')).toEqual(['auto', 'context']);
  });

  test('splits snake_case into parts', () => {
    expect(queryTerms('get_user')).toEqual(['get', 'user']);
  });

  test('splits mixed camelCase and whitespace', () => {
    const terms = queryTerms('getUser fileName');
    expect(terms).toContain('get');
    expect(terms).toContain('user');
    expect(terms).toContain('file');
    expect(terms).toContain('name');
  });

  test('handles all-caps token as single term', () => {
    expect(queryTerms('URL')).toEqual(['url']);
  });

  test('deduplicates repeated terms', () => {
    expect(queryTerms('dup dup')).toEqual(['dup']);
  });

  test('handles leading and trailing underscores', () => {
    expect(queryTerms('_leading_')).toEqual(['leading']);
  });

  test('returns empty array for empty string', () => {
    expect(queryTerms('')).toEqual([]);
  });

  test('lowercases all terms', () => {
    const terms = queryTerms('GetUser');
    expect(terms.every((t) => t === t.toLowerCase())).toBe(true);
  });
});
