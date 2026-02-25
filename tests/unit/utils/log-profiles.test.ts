import { describe, expect, test } from 'bun:test';
import {
  parseLogProfile,
  profileOptions,
  resolveProfiledOptions,
} from '../../../src/utils/log-profiles.js';

describe('parseLogProfile', () => {
  test('parses supported profiles', () => {
    expect(parseLogProfile('test')).toBe('test');
    expect(parseLogProfile('ci')).toBe('ci');
    expect(parseLogProfile('lint')).toBe('lint');
    expect(parseLogProfile('runtime')).toBe('runtime');
  });

  test('returns undefined for unsupported values', () => {
    expect(parseLogProfile('unknown')).toBeUndefined();
  });
});

describe('profileOptions', () => {
  test('lint profile provides custom diagnostic rules', () => {
    const profile = profileOptions('lint');
    expect(profile.customRules).toBeDefined();
    expect(profile.customRules?.length).toBeGreaterThan(0);
  });

  test('runtime profile strips timestamps by default', () => {
    const profile = profileOptions('runtime');
    expect(profile.stripTimestamps).toBe('strip');
  });
});

describe('resolveProfiledOptions', () => {
  test('applies profile defaults when user options are missing', () => {
    const options = resolveProfiledOptions('runtime', {});
    expect(options.stripTimestamps).toBe('strip');
    expect(options.elideHealthChecks).toBe(true);
  });

  test('user-defined values override profile defaults', () => {
    const options = resolveProfiledOptions('runtime', { stripTimestamps: 'keep' });
    expect(options.stripTimestamps).toBe('keep');
  });
});
