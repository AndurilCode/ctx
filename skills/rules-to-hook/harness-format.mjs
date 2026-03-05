// Translate abstract harness tool names into actionable commands.

export function formatSuggestion(tool, args) {
  const file = args.file || args.file_path || '';
  switch (tool) {
    case 'outline':
      return `an outline: \`npx @anduril-code/ctx outline ${file}\``;
    case 'focus':
      return `a focused read: \`npx @anduril-code/ctx symbols ${file}\``;
    case 'rank':
      return `a ranked search: \`npx @anduril-code/ctx rank "${args.query || ''}" --maxResults ${args.maxResults || 5}\``;
    case 'read':
      if (args.maxTokens) return `a budgeted read: \`Read ${file}\` with offset/limit to ~${Math.round(args.maxTokens)} tokens`;
      return `reading \`${file}\``;
    default:
      return `\`${tool}(${JSON.stringify(args)})\``;
  }
}
