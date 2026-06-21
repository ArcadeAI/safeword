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

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { shapeFingerprint } from './architecture-fingerprint.js';
import { extractSkeleton } from './architecture-skeleton.js';
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
  const path = resolveConfiguredPath(projectDirectory, 'architecture');
  const fingerprint = shapeFingerprint(projectDirectory);
  const action = decideAction(readExisting(path), fingerprint);

  if (action !== 'unchanged') {
    mkdirSync(nodePath.dirname(path), { recursive: true });
    writeFileSync(path, renderDocument(projectDirectory, fingerprint));
  }

  return { action, path };
}

function readExisting(path: string): string | undefined {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return undefined;
  }
}

function decideAction(existing: string | undefined, fingerprint: string): SelfHealAction {
  if (existing === undefined) return 'created';

  const recorded = readDocumentFingerprint(existing);
  if (recorded === undefined) return 'regenerated';
  if (recorded !== fingerprint) return 'healed';
  return 'unchanged';
}

function renderDocument(projectDirectory: string, fingerprint: string): string {
  const sections = extractSkeleton(projectDirectory)
    .nodes.map(node => `### ${node.name}\n\n\`${node.path}\` — ${node.purpose}\n`)
    .join('\n');

  return `---\n${FINGERPRINT_KEY}: ${fingerprint}\n---\n\n# Architecture\n\n## Modules\n\n${sections}`;
}
