import { PLANNING_SHARED_CLAUSES } from './shared-contract.js';

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
  for (const clauseId of Object.keys(PLANNING_SHARED_CLAUSES)) {
    if (!content.includes(`<!-- SAFEWORD:PLANNING_SHARED_CLAUSE:${clauseId} -->`)) {
      throw new MissingGeneratedSharedClauseError(clauseId, contractPath);
    }
  }
}
