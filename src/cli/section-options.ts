function flattenToStrings(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => flattenToStrings(entry));
  }

  if (typeof value !== 'string') {
    return [];
  }

  return value.split(',').map((entry) => entry.trim());
}

export function parseSectionOptions(value: unknown): string[] | undefined {
  const values = flattenToStrings(value).filter((entry) => entry.length > 0);
  return values.length > 0 ? values : undefined;
}
