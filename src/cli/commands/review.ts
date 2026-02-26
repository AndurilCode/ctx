import { defineCommand } from 'citty';
import { review } from '../../core/review.js';

export const reviewCommand = defineCommand({
  meta: {
    name: 'review',
    description: 'Two-pass token-efficient code review report for a query.',
  },
  args: {
    query: { type: 'positional', required: true, description: 'Task or review query' },
    path: { type: 'string', required: false, description: 'Root directory to search (default: cwd)' },
    glob: { type: 'string', required: false, description: 'File pattern (default: **/*.{ts,tsx,js,jsx})' },
    maxResults: { type: 'string', required: false, default: '10', description: 'Max ranked files to review' },
    pass1Tokens: { type: 'string', required: false, default: '600', description: 'Pass-1 token budget per file' },
    pass2Tokens: { type: 'string', required: false, default: '2000', description: 'Pass-2 token budget per file' },
    maxPass2Files: { type: 'string', required: false, default: '3', description: 'Max files to escalate to pass-2' },
    riskTerms: { type: 'string', required: false, description: 'Comma-separated risk terms override' },
  },
  async run({ args }) {
    const riskTerms = args.riskTerms
      ? String(args.riskTerms)
          .split(',')
          .map((term) => term.trim())
          .filter(Boolean)
      : undefined;

    const result = await review({
      query: String(args.query),
      path: args.path ? String(args.path) : undefined,
      glob: args.glob ? String(args.glob) : undefined,
      maxResults: Number(args.maxResults),
      pass1Tokens: Number(args.pass1Tokens),
      pass2Tokens: Number(args.pass2Tokens),
      maxPass2Files: Number(args.maxPass2Files),
      riskTerms,
    });

    process.stdout.write(JSON.stringify(result, null, 2));
    process.stdout.write('\n');
  },
});
