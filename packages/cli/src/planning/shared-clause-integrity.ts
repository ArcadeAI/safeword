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
  const block =
    /<!-- SAFEWORD:PLANNING_SHARED_START -->([\s\S]*?)<!-- SAFEWORD:PLANNING_SHARED_END -->/u.exec(
      content,
    )?.[1] ?? '';
  for (const [clauseId, text] of Object.entries(PLANNING_SHARED_CLAUSES)) {
    const clause = `<!-- SAFEWORD:PLANNING_SHARED_CLAUSE:${clauseId} -->\n\n${text}\n\n`;
    if (!block.includes(clause)) {
      throw new MissingGeneratedSharedClauseError(clauseId, contractPath);
    }
  }
}
