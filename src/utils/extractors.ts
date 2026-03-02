export function extractSymbolNames(content: string): string[] {
  const pattern = /(?:export\s+)?(?:function|const|let|var|class|interface|type|enum)\s+(\w+)/g;
  const names: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(content)) !== null) {
    names.push(m[1] as string);
  }
  return names;
}

export function extractHeadings(content: string): string[] {
  const headings: string[] = [];
  for (const line of content.split('\n')) {
    const m = line.match(/^#{1,6}\s+(.+)/);
    if (m) headings.push(m[1] as string);
  }
  return headings;
}
