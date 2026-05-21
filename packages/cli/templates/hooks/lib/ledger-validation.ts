// Done-gate annotation ledger validator (ticket J7VBGJ, Rules 3 + 4).
// Pure function over test-definitions.md content + an injected SHA-reachability
// oracle. Returns { ok, errors[] }. The wiring layer in stop-quality.ts calls
// the real `git cat-file -e <sha>^{commit}` to provide the oracle.
//
// RED-phase stub. Implementation lands at GREEN.

export interface LedgerValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateLedger(
  _content: string,
  _isReachable: (sha: string) => boolean,
): LedgerValidationResult {
  throw new Error('validateLedger: not implemented (RED stub)');
}
