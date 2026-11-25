/** Keep the public workflow identity stable across OpenCode's native API versions. */
export function openCodeWorkflowName(name: string): string {
  return `safeword-${name}`;
}
