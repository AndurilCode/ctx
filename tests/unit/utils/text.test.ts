import { describe, expect, test } from 'bun:test';
import {
  collapseBlankLines,
  containsSectionQuery,
  csvRow,
  formatExtractOverflow,
  needsCsvQuoting,
  normalizeExtractLimit,
  normalizeSectionQuery,
  normalizeSmartPunctuation,
  parseCsvRow,
  quoteCsvValue,
  stripTrailingHeadingHashes,
  stripTrailingWhitespace,
  truncateForExtract,
  unwrapSoftLineBreaks,
} from '../../../src/utils/text.js';

describe('stripTrailingWhitespace', () => {
  test('removes trailing spaces and tabs per line', () => {
    expect(stripTrailingWhitespace('hello  \nworld\t\n')).toBe('hello\nworld\n');
  });

  test('leaves lines without trailing whitespace unchanged', () => {
    expect(stripTrailingWhitespace('hello\nworld')).toBe('hello\nworld');
  });
});

describe('collapseBlankLines', () => {
  test('collapses 3+ blank lines to 2', () => {
    expect(collapseBlankLines('a\n\n\n\nb')).toBe('a\n\nb');
  });

  test('leaves double newlines unchanged', () => {
    expect(collapseBlankLines('a\n\nb')).toBe('a\n\nb');
  });
});

describe('needsCsvQuoting', () => {
  test('returns true when value contains delimiter', () => {
    expect(needsCsvQuoting('a,b', ',')).toBe(true);
  });

  test('returns true when value contains newline', () => {
    expect(needsCsvQuoting('a\nb', ',')).toBe(true);
  });

  test('returns true when value contains quote', () => {
    expect(needsCsvQuoting('say "hi"', ',')).toBe(true);
  });

  test('returns false for plain value', () => {
    expect(needsCsvQuoting('hello', ',')).toBe(false);
  });
});

describe('quoteCsvValue', () => {
  test('wraps value containing delimiter in quotes', () => {
    expect(quoteCsvValue('a,b', ',')).toBe('"a,b"');
  });

  test('escapes internal quotes by doubling', () => {
    expect(quoteCsvValue('say "hi"', ',')).toBe('"say ""hi"""');
  });

  test('returns plain value unchanged when no quoting needed', () => {
    expect(quoteCsvValue('hello', ',')).toBe('hello');
  });
});

describe('parseCsvRow', () => {
  test('splits simple row', () => {
    expect(parseCsvRow('a, b, c', ',')).toEqual(['a', 'b', 'c']);
  });

  test('handles quoted values containing delimiter', () => {
    expect(parseCsvRow('"a,b", c', ',')).toEqual(['a,b', 'c']);
  });

  test('handles doubled quotes inside quoted value', () => {
    expect(parseCsvRow('"say ""hi"""', ',')).toEqual(['say "hi"']);
  });

  test('round-trips through csvRow', () => {
    const values = ['hello', 'with, comma', 'say "hi"'];
    const row = csvRow(values, ',');
    expect(parseCsvRow(row, ',')).toEqual(values);
  });
});

describe('csvRow', () => {
  test('joins values with delimiter and space', () => {
    expect(csvRow(['a', 'b', 'c'], ',')).toBe('a, b, c');
  });

  test('quotes values that need it', () => {
    expect(csvRow(['a,b', 'c'], ',')).toBe('"a,b", c');
  });
});

describe('normalizeSmartPunctuation', () => {
  test('converts curly quotes to straight', () => {
    expect(normalizeSmartPunctuation('\u2018hello\u2019')).toBe("'hello'");
    expect(normalizeSmartPunctuation('\u201chello\u201d')).toBe('"hello"');
  });

  test('converts en dash and em dash', () => {
    expect(normalizeSmartPunctuation('\u2013')).toBe('-');
    expect(normalizeSmartPunctuation('\u2014')).toBe('--');
  });

  test('converts ellipsis and NBSP', () => {
    expect(normalizeSmartPunctuation('\u2026')).toBe('...');
    expect(normalizeSmartPunctuation('\u00a0')).toBe(' ');
  });
});

describe('stripTrailingHeadingHashes', () => {
  test('removes trailing hashes from ATX heading', () => {
    expect(stripTrailingHeadingHashes('Hello ##')).toBe('Hello');
  });

  test('leaves headings without trailing hashes unchanged', () => {
    expect(stripTrailingHeadingHashes('Hello')).toBe('Hello');
  });
});

describe('normalizeSectionQuery', () => {
  test('trims and lowercases', () => {
    expect(normalizeSectionQuery('  Hello World  ')).toBe('hello world');
  });
});

describe('containsSectionQuery', () => {
  test('returns true when heading includes query', () => {
    expect(containsSectionQuery('Installation Guide', ['install'])).toBe(true);
  });

  test('is case insensitive', () => {
    expect(containsSectionQuery('API Reference', ['api'])).toBe(true);
  });

  test('returns false when no query matches', () => {
    expect(containsSectionQuery('Getting Started', ['install'])).toBe(false);
  });
});

describe('unwrapSoftLineBreaks', () => {
  test('replaces single newlines with spaces', () => {
    expect(unwrapSoftLineBreaks('hello\nworld')).toBe('hello world');
  });

  test('preserves double newlines (paragraph breaks)', () => {
    expect(unwrapSoftLineBreaks('para one\n\npara two')).toBe('para one\n\npara two');
  });
});

describe('normalizeExtractLimit', () => {
  test('returns fallback for undefined', () => {
    expect(normalizeExtractLimit(undefined, 100)).toBe(100);
  });

  test('returns fallback for NaN', () => {
    expect(normalizeExtractLimit(Number.NaN, 100)).toBe(100);
  });

  test('clamps to 0 for negative values', () => {
    expect(normalizeExtractLimit(-5, 100)).toBe(0);
  });

  test('floors non-integer values', () => {
    expect(normalizeExtractLimit(3.9, 100)).toBe(3);
  });

  test('returns value when valid', () => {
    expect(normalizeExtractLimit(50, 100)).toBe(50);
  });
});

describe('truncateForExtract', () => {
  test('returns original when within limit', () => {
    expect(truncateForExtract('hello', 10)).toEqual({ value: 'hello', truncated: false });
  });

  test('truncates and appends ellipsis when over limit', () => {
    const result = truncateForExtract('hello world', 5);
    expect(result.truncated).toBe(true);
    expect(result.value).toContain('...');
  });

  test('returns ellipsis when maxChars is 0', () => {
    expect(truncateForExtract('hello', 0)).toEqual({ value: '...', truncated: true });
  });

  test('empty input with 0 maxChars is not truncated', () => {
    expect(truncateForExtract('', 0)).toEqual({ value: '...', truncated: false });
  });
});

describe('formatExtractOverflow', () => {
  test('formats items overflow', () => {
    expect(formatExtractOverflow('items', 3)).toBe('... 3 more items');
  });

  test('formats rows overflow', () => {
    expect(formatExtractOverflow('rows', 10)).toBe('... 10 more rows');
  });
});
