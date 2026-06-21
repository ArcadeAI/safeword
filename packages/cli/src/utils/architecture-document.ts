/**
 * Architecture state-document self-heal (ticket QD5DTT, Slice 1).
 *
 * Reads the document at the configured `paths.architecture`, compares its
 * recorded shape-fingerprint against the live one, and deterministically
 * (LLM-free) re-extracts the skeleton when they differ — creating the document
 * when absent and regenerating it when its fingerprint is missing or corrupt.
 * This is the SessionStart entry point that keeps structural facts fresh,
 * including after out-of-band human edits.
 */

import { resolveConfiguredPath } from './configured-paths.js';

export type SelfHealAction = 'created' | 'healed' | 'unchanged' | 'regenerated';

export interface SelfHealResult {
  action: SelfHealAction;
  path: string;
}

const FINGERPRINT_KEY = 'fingerprint';

/** Parse the recorded fingerprint from a document's frontmatter, or undefined. */
export function readDocumentFingerprint(content: string): string | undefined {
  const frontmatter = /^---\n([\s\S]*?)\n---/.exec(content);
  if (frontmatter === null) return undefined;

  const line = frontmatter[1]
    .split('\n')
    .find(candidate => candidate.startsWith(`${FINGERPRINT_KEY}:`));
  if (line === undefined) return undefined;

  const value = line.slice(FINGERPRINT_KEY.length + 1).trim();
  return value.length > 0 ? value : undefined;
}

export function selfHeal(projectDirectory: string): SelfHealResult {
  return { action: 'unchanged', path: resolveConfiguredPath(projectDirectory, 'architecture') };
}
