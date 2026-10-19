/** Git emits an empty prefix at the repository root and a slash-terminated nested prefix. */
export function parseGitProjectPrefix(output: string): string | undefined {
  const prefix = output.slice(0, -1);
  if (
    !output.endsWith('\n') ||
    prefix.startsWith('/') ||
    (prefix !== '' && !prefix.endsWith('/')) ||
    prefix.split('/').includes('..')
  ) {
    return undefined;
  }
  return prefix;
}
