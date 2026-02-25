import type { LogCustomRule, LogPruneOptions, LogPruneProfile } from '../types/log.js';

export function parseLogProfile(value: unknown): LogPruneProfile | undefined {
  if (typeof value !== 'string') return undefined;
  const profile = value.trim().toLowerCase();
  if (profile === 'test' || profile === 'ci' || profile === 'lint' || profile === 'runtime') {
    return profile;
  }
  return undefined;
}

export function profileOptions(profile: LogPruneProfile | undefined): Partial<LogPruneOptions> {
  if (!profile) return {};

  switch (profile) {
    case 'test':
      return {
        elidePassingTests: true,
        foldProgress: false,
        foldFrameworkStartup: false,
        customRules: [{ type: 'fold', pattern: '^\\(pass\\)', label: 'passes' }],
      };
    case 'ci':
      return {
        foldProgress: true,
        foldFrameworkStartup: true,
        foldDebugLines: true,
        stripTimestamps: 'auto',
        customRules: [
          { type: 'strip', pattern: '^npm warn deprecated\\b' },
          { type: 'strip', pattern: '^\\d+ packages are looking for funding' },
          { type: 'strip', pattern: '^\\s+run `npm fund`' },
          { type: 'fold', pattern: '^Run actions\\/', label: 'ci-setup' },
        ],
      };
    case 'lint':
      return {
        foldFrameworkStartup: false,
        foldJsonLines: false,
        customRules: [
          { type: 'block', start: '^\\./', end: '^\\s*$', label: 'diagnostic' },
          { type: 'strip', pattern: '^\\s*[0-9]+\\s+[0-9]+\\s+│' },
          { type: 'strip', pattern: '^\\s*[0-9]+\\s+│' },
        ],
      };
    case 'runtime':
      return {
        stripTimestamps: 'strip',
        foldDebugLines: true,
        elideHealthChecks: true,
        stripUserAgents: true,
        dedupeStackTraces: true,
        foldJsonLines: true,
      };
  }
}

export function mergeCustomRules(
  profileRules: LogCustomRule[] | undefined,
  userRules: LogCustomRule[] | undefined,
): LogCustomRule[] | undefined {
  const merged = [...(profileRules ?? []), ...(userRules ?? [])];
  return merged.length > 0 ? merged : undefined;
}

export function resolveProfiledOptions(
  profile: LogPruneProfile | undefined,
  user: LogPruneOptions,
): LogPruneOptions {
  const preset = profileOptions(profile);
  const userDefined = Object.fromEntries(
    Object.entries(user).filter(([, value]) => value !== undefined),
  ) as LogPruneOptions;
  return {
    ...preset,
    ...userDefined,
    customRules: mergeCustomRules(preset.customRules, user.customRules),
  };
}
