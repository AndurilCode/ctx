import { relative, resolve } from 'node:path';
import { budgetedRead } from './read.js';
import { relevance } from './relevance.js';
import type { EvidenceLine, ReviewFileResult, ReviewOptions, ReviewResult } from '../types/review.js';
import { discoverFilesCached } from '../utils/discovery-cache.js';
import { extractEvidence } from '../utils/evidence.js';
import { getChangedFiles } from '../utils/git.js';

const DEFAULT_GLOB = '**/*.{ts,tsx,js,jsx}';
const DEFAULT_IGNORE = ['node_modules/**', 'dist/**', '.git/**'];
const DEFAULT_MAX_RESULTS = 10;
const DEFAULT_PASS1_TOKENS = 600;
const DEFAULT_PASS2_TOKENS = 2000;
const DEFAULT_MAX_PASS2_FILES = 3;
const DEFAULT_RISK_TERMS = [
  'deadline',
  'return false',
  'open(lockpath',
  'writefilesync',
  'renamesync',
  'atomic',
  'todo',
  'fixme',
  'hack',
];

function normalizeRiskTerms(input?: string[]): string[] {
  if (!input || input.length === 0) return [...DEFAULT_RISK_TERMS];
  return input.map((term) => term.trim().toLowerCase()).filter(Boolean);
}

function matchedRiskTerms(content: string, terms: string[]): string[] {
  const haystack = content.toLowerCase();
  return terms.filter((term, index) => haystack.includes(term) && terms.indexOf(term) === index);
}

function computeReductionPercent(savedTokens: number, fullTokens: number): number {
  if (fullTokens <= 0) return 0;
  return Number(((savedTokens * 100) / fullTokens).toFixed(1));
}

export async function review(options: ReviewOptions): Promise<ReviewResult> {
  const root = resolve(options.path ?? '.');
  const globPattern = options.glob ?? DEFAULT_GLOB;
  const maxResults = options.maxResults ?? DEFAULT_MAX_RESULTS;
  const pass1Tokens = options.pass1Tokens ?? DEFAULT_PASS1_TOKENS;
  const pass2Tokens = options.pass2Tokens ?? DEFAULT_PASS2_TOKENS;
  const maxPass2Files = options.maxPass2Files ?? DEFAULT_MAX_PASS2_FILES;
  const riskTerms = normalizeRiskTerms(options.riskTerms);

  const relFiles = await discoverFilesCached({
    root,
    globPattern,
    ignore: DEFAULT_IGNORE,
  });
  const absFiles = relFiles.map((file) => resolve(root, file));

  const ranked = await relevance({
    query: options.query,
    files: absFiles,
    maxResults,
  });

  const rawChanged = options.changedFiles ?? (options.diffBase ? getChangedFiles(root, options.diffBase) : []);
  const changedSet = new Set(rawChanged.map((f) => resolve(f)));

  const CHANGED_BOOST = 2;
  const candidates = changedSet.size > 0
    ? [...ranked.results]
        .map((r) => ({ ...r, score: changedSet.has(r.file) ? r.score * CHANGED_BOOST : r.score }))
        .sort((a, b) => b.score - a.score)
    : ranked.results;

  const cwd = resolve('.');
  const files: ReviewFileResult[] = [];
  let pass2Count = 0;

  for (const candidate of candidates) {
    const displayFile = relative(cwd, candidate.file);
    const pass1 = await budgetedRead({ file: candidate.file, maxTokens: pass1Tokens });
    const matched = matchedRiskTerms(pass1.content, riskTerms);
    const flagged = matched.length > 0;

    let pass2Used = 0;
    let pass2Strategy: string | undefined;

    if (flagged && pass1.strategy !== 'full' && pass2Count < maxPass2Files) {
      const pass2 = await budgetedRead({ file: candidate.file, maxTokens: pass2Tokens });
      pass2Used = pass2.returnedTokens;
      pass2Strategy = pass2.strategy;
      pass2Count += 1;
    }

    let evidence: EvidenceLine[] | undefined;
    if (options.evidence && flagged && matched.length > 0) {
      evidence = await extractEvidence(candidate.file, matched);
    }

    files.push({
      file: displayFile,
      score: candidate.score,
      fullTokens: pass1.totalTokens,
      pass1Tokens: pass1.returnedTokens,
      pass1Strategy: pass1.strategy,
      flagged,
      matchedRiskTerms: matched,
      pass2Tokens: pass2Used,
      pass2Strategy,
      ...(evidence !== undefined ? { evidence } : {}),
    });
  }

  const fullTokens = files.reduce((sum, file) => sum + file.fullTokens, 0);
  const pass1Used = files.reduce((sum, file) => sum + file.pass1Tokens, 0);
  const pass2Used = files.reduce((sum, file) => sum + file.pass2Tokens, 0);
  const twoPassTokens = pass1Used + pass2Used;
  const savedTokens = fullTokens - twoPassTokens;

  return {
    query: options.query,
    root,
    glob: globPattern,
    files,
    totals: {
      fullTokens,
      pass1Tokens: pass1Used,
      pass2Tokens: pass2Used,
      pass2Files: pass2Count,
      twoPassTokens,
      savedTokens,
      reductionPercent: computeReductionPercent(savedTokens, fullTokens),
    },
  };
}
