// Whether the reviewer may EXECUTE the code under review (ticket 36EEMY, SM1.R3).
//
// The tripwire is execution of untrusted code while a credential is present —
// not reading it. Cloning a fork's head and sending it to the model as data is
// safe in a credentialed job; building it, running its tests, or reproducing
// against it is not. The two gates that execute (R12 base-reproduction, R13
// fix-run) and R17's live environment consult this before doing anything.

export type ExecutionTier =
  /** Same-repo: the head is trusted, so the run gates may execute it. */
  | 'execute'
  /** Fork: read it, never run it. The gates degrade and say so in their output. */
  | 'degrade';

export interface ExecutionContext {
  /** True when the pull request's head comes from a fork of this repository. */
  isFork: boolean;
}

/**
 * Decide whether the run gates may execute this pull request's head.
 *
 * Deliberately a pure predicate over one fact. It is not "is a credential
 * present?" — by the time the runner reaches the gates it always holds one, so
 * asking that would make the answer uniformly `degrade` and quietly disable the
 * gates everywhere. Fork-ness is the property that actually distinguishes
 * trusted code from attacker-supplied code.
 */
export function resolveExecutionTier(context: ExecutionContext): ExecutionTier {
  return context.isFork ? 'degrade' : 'execute';
}
