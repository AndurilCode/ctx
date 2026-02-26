import { readFile } from 'node:fs/promises';
import { defineCommand } from 'citty';

export const searchSectionsCommand = defineCommand({
  meta: {
    name: 'locate',
    description: 'Search for sections matching a keyword across one or more markdown files.',
  },
  args: {
    query: {
      type: 'positional',
      required: true,
      description: 'Keyword to search for in section headings.',
    },
  },
  async run({ args }) {
    const [{ astToMarkdown }, { markdownToAst }, { buildHeadingRanges }, { createTokenCounter }] =
      await Promise.all([
        import('../../parser/ast-to-markdown.js'),
        import('../../parser/markdown-to-ast.js'),
        import('../../utils/headings.js'),
        import('../../utils/tokens.js'),
      ]);

    const query = String(args.query).toLowerCase();
    // args._ contains all positionals; the first one is `query` itself, so skip it
    const files: string[] = (args._ ?? []).slice(1).map(String);

    if (files.length === 0) {
      process.stderr.write('error: at least one file path is required\n');
      process.exit(1);
    }

    const tokenCounter = await createTokenCounter();

    interface SectionMatch {
      file: string;
      section: string;
      depth: number;
      tokens: number;
    }

    const matches: SectionMatch[] = [];

    for (const file of files) {
      let markdown: string;
      try {
        markdown = await readFile(file, 'utf-8');
      } catch {
        process.stderr.write(`warning: could not read ${file}\n`);
        continue;
      }

      const tree = markdownToAst(markdown);
      const ranges = buildHeadingRanges(tree);

      for (const range of ranges) {
        if (!range.text.toLowerCase().includes(query)) continue;
        const sectionTree = {
          type: 'root' as const,
          children: tree.children.slice(range.start, range.end),
        };
        const tokens = tokenCounter.count(astToMarkdown(sectionTree));
        matches.push({ file, section: range.text, depth: range.depth, tokens });
      }
    }

    if (matches.length === 0) {
      process.stdout.write(
        `No sections matching "${args.query}" found across ${files.length} file(s).\n`,
      );
      return;
    }

    let currentFile = '';
    const lines: string[] = [];
    for (const { file, section, depth, tokens } of matches) {
      if (file !== currentFile) {
        if (currentFile !== '') lines.push('');
        lines.push(file);
        currentFile = file;
      }
      const indent = '  '.repeat(depth - 1);
      lines.push(`${indent}${'#'.repeat(depth)} ${section}  (${tokens} tokens)`);
    }

    process.stdout.write(`${lines.join('\n')}\n`);
  },
});
