import { createHash } from 'node:crypto';

import { PLANNING_SHARED_CLAUSES } from './shared-contract.js';

const sharedBlockPattern =
  /<!-- SAFEWORD:PLANNING_SHARED_START -->([\s\S]*?)<!-- SAFEWORD:PLANNING_SHARED_END -->/gu;

function sharedBlocks(content: string): string[] {
  return content
    .matchAll(sharedBlockPattern)
    .map(match => match[1] ?? '')
    .toArray();
}

export function sharedAuthorityDigest(content: string): string {
  const blocks = sharedBlocks(content);
  if (blocks.length !== 1)
    throw new Error('Planning contract must contain one shared authority block.');
  const authority = (blocks[0] ?? '')
    .replaceAll(/<!--[\s\S]*?-->/gu, '')
    .replaceAll(/\s+/gu, ' ')
    .trim();
  if (authority === '') throw new Error('Planning shared authority block cannot be empty.');
  return createHash('sha256').update(authority).digest('hex');
}

/** A generated author contract cannot omit a shared authority obligation. */
export class MissingGeneratedSharedClauseError extends Error {
  readonly code = 'missing_generated_shared_clause';

  constructor(
    readonly clauseId: string,
    readonly contractPath: string,
  ) {
    super(`Generated planning contract ${contractPath} is missing shared clause ${clauseId}.`);
    this.name = 'MissingGeneratedSharedClauseError';
  }
}

export function assertGeneratedSharedClauses(content: string, contractPath: string): void {
  const block = sharedBlocks(content)[0] ?? '';
  for (const [clauseId, text] of Object.entries(PLANNING_SHARED_CLAUSES)) {
    const clause = `<!-- SAFEWORD:PLANNING_SHARED_CLAUSE:${clauseId} -->\n\n${text}\n\n`;
    if (!block.includes(clause)) {
      throw new MissingGeneratedSharedClauseError(clauseId, contractPath);
    }
  }
}
