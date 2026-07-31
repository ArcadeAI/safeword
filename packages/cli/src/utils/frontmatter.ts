/** Read one scalar field from a `---`-fenced YAML frontmatter block. */
export function readFrontmatterScalar(
  content: string | undefined,
  field: string,
): string | undefined {
  const lines = content?.split(/\r?\n/) ?? [];
  if (lines[0] !== '---') return undefined;
  const prefix = `${field}:`;
  for (const line of lines.slice(1)) {
    if (line === '---') return undefined;
    if (!line.startsWith(prefix)) continue;
    const value = line.slice(prefix.length).trim();
    return value === '' ? undefined : value;
  }
  return undefined;
}
