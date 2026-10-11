import { spawnSync } from 'node:child_process';

import { type CliResult, createResult } from '../cli-protocol/result.js';
import { LEDGER_RECOVERY_PROFILE } from './ledger-recovery-profile.js';
import { proofExecutable } from './retrospective-proof.js';

export function observeLedgerRecovery(cwd: string, ticket: string): CliResult {
  if (ticket !== LEDGER_RECOVERY_PROFILE.ticket) {
    return blocked(
      'LEDGER_RECOVERY_SCOPE_MISMATCH',
      'Completion recovery is limited to the approved 5F5ZZA scope.',
    );
  }
  let git: string;
  try {
    git = proofExecutable(cwd, 'git', 'Git');
  } catch {
    return blocked(
      'LEDGER_RECOVERY_BASELINE_REQUIRED',
      'An external Git executable is required to inspect the approved baseline.',
    );
  }
  const ancestry = spawnSync(
    git,
    [
      '--no-replace-objects',
      '-C',
      cwd,
      'merge-base',
      '--is-ancestor',
      LEDGER_RECOVERY_PROFILE.baseline,
      'HEAD',
    ],
    {
      encoding: 'utf8',
      timeout: 30_000,
      env: Object.fromEntries(
        Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')),
      ),
    },
  );
  if (ancestry.error !== undefined || ancestry.status !== 0) {
    return blocked(
      'LEDGER_RECOVERY_BASELINE_REQUIRED',
      'Observation requires a committed candidate descended from the approved baseline.',
    );
  }
  return blocked(
    'LEDGER_RECOVERY_OBSERVATION_REQUIRED',
    'Authenticated observation through the fixed current-scope runner is still required.',
  );
}

function blocked(code: string, message: string): CliResult {
  return createResult({
    state: 'action_required',
    findings: [{ code, message, severity: 'warning' }],
    data: { command: 'review observe ledger-recovery', status: 'blocked' },
  });
}
