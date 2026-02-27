export type ReviewProfile = 'code' | 'full' | 'docs';

interface ProfileConfig {
  glob: string;
  extraIgnore: string[];
}

const PROFILES: Record<ReviewProfile, ProfileConfig> = {
  code: {
    glob: '**/*.{ts,tsx,js,jsx,py,go,rs,java,c,cpp}',
    extraIgnore: ['docs/**', 'bench/**'],
  },
  full: {
    glob: '**/*.{ts,tsx,js,jsx,md,mdx,json,yaml,yml}',
    extraIgnore: [],
  },
  docs: {
    glob: '**/*.{md,mdx,markdown}',
    extraIgnore: [],
  },
};

export function resolveProfile(profile?: ReviewProfile): ProfileConfig {
  return PROFILES[profile ?? 'code'];
}
