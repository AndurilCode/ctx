import { defineCommand } from 'citty';
import { createHarnessState, decide } from '../../core/harness/index.js';

export const harnessCommand = defineCommand({
  meta: {
    name: 'harness',
    description:
      'Evaluate a tool call against the context harness decision engine.',
  },
  args: {
    tool: {
      type: 'positional',
      required: true,
      description: 'The tool being called (read, grep, edit, etc.)',
    },
    args: {
      type: 'string',
      required: true,
      description: 'Tool arguments as JSON object',
    },
    fileTokens: {
      type: 'string',
      required: false,
      description: 'Estimated token count of the target file',
    },
    contextWindow: {
      type: 'string',
      required: false,
      default: '200000',
      description: 'Total context window size in tokens',
    },
    taskDescription: {
      type: 'string',
      required: false,
      description: 'Description of the current task',
    },
  },
  async run({ args }) {
    const toolArgs: Record<string, unknown> = JSON.parse(String(args.args));
    const state = createHarnessState({
      contextWindow: Number(args.contextWindow),
    });

    const fileTokens = new Map<string, number>();
    const file = (toolArgs.file ?? toolArgs.file_path) as string | undefined;
    if (file && args.fileTokens) {
      fileTokens.set(file, Number(args.fileTokens));
    }

    const decision = await decide(
      { tool: String(args.tool), args: toolArgs },
      state,
      {
        fileTokens,
        mentionedSymbols: [],
        taskDescription: args.taskDescription
          ? String(args.taskDescription)
          : undefined,
      },
    );

    process.stdout.write(JSON.stringify(decision, null, 2));
    process.stdout.write('\n');
  },
});
