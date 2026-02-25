import { describe, expect, test } from 'bun:test';
import { parseSectionOptions } from '../../../src/cli/section-options.js';

describe('parseSectionOptions', () => {
  test('returns undefined for undefined input', () => {
    expect(parseSectionOptions(undefined)).toBeUndefined();
  });

  test('returns undefined for empty string', () => {
    expect(parseSectionOptions('')).toBeUndefined();
  });

  test('returns undefined for empty array', () => {
    expect(parseSectionOptions([])).toBeUndefined();
  });

  test('parses a plain string', () => {
    expect(parseSectionOptions('install')).toEqual(['install']);
  });

  test('splits comma-separated values in a string', () => {
    expect(parseSectionOptions('install, setup, deploy')).toEqual(['install', 'setup', 'deploy']);
  });

  test('parses an array of strings', () => {
    expect(parseSectionOptions(['install', 'setup'])).toEqual(['install', 'setup']);
  });

  test('splits comma-separated values within array entries', () => {
    expect(parseSectionOptions(['install, setup', 'deploy'])).toEqual([
      'install',
      'setup',
      'deploy',
    ]);
  });

  test('ignores non-string, non-array values', () => {
    expect(parseSectionOptions(42)).toBeUndefined();
    expect(parseSectionOptions(true)).toBeUndefined();
  });

  test('filters out empty entries after splitting', () => {
    expect(parseSectionOptions(',,')).toBeUndefined();
  });
});
