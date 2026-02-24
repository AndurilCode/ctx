import { describe, expect, test } from 'bun:test';
import fc from 'fast-check';
import { verify } from '../../src/core/verify.js';

const WORDS = [
  'alpha',
  'beta',
  'gamma',
  'delta',
  'token',
  'compact',
  'markdown',
  'pipeline',
  'agent',
  'stage',
  'verify',
  'format',
];

const wordArb = fc.constantFrom(...WORDS);
const sentenceArb = fc
  .array(wordArb, { minLength: 3, maxLength: 10 })
  .map((words) => words.join(' '));

const headingArb = fc
  .tuple(fc.integer({ min: 1, max: 4 }), sentenceArb)
  .map(([depth, text]) => `${'#'.repeat(depth)} ${text}`);

const paragraphArb = sentenceArb.map((text) => `${text}.`);

const taskListArb = fc
  .array(sentenceArb, { minLength: 1, maxLength: 4 })
  .map((items) =>
    items.map((item, index) => `- [${index % 2 === 0 ? ' ' : 'x'}] ${item}`).join('\n'),
  );

const orderedListArb = fc
  .array(sentenceArb, { minLength: 1, maxLength: 4 })
  .map((items) => items.map((item, index) => `${index + 1}. ${item}`).join('\n'));

const tableArb = fc
  .tuple(sentenceArb, sentenceArb, sentenceArb, sentenceArb)
  .map(([h1, h2, r1, r2]) => {
    return `| ${h1} | ${h2} |\n| --- | --- |\n| ${r1} | ${r2} |`;
  });

const codeArb = sentenceArb.map(
  (text) => `\`\`\`ts\nconsole.log(${JSON.stringify(text)});\n\`\`\``,
);

const blockArb = fc.oneof(headingArb, paragraphArb, taskListArb, orderedListArb, tableArb, codeArb);

const markdownDocArb = fc
  .array(blockArb, { minLength: 1, maxLength: 10 })
  .map((blocks) => `${blocks.join('\n\n')}\n`);

describe('property-based round-trip', () => {
  test('round-trips generated markdown', () => {
    fc.assert(
      fc.property(markdownDocArb, (markdown) => {
        expect(verify(markdown)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  test('round-trips generated markdown with dedup enabled', () => {
    fc.assert(
      fc.property(markdownDocArb, (markdown) => {
        expect(verify(markdown, { dedup: true })).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
