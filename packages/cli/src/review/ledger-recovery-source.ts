import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

import { frontmatterOf } from '../../templates/hooks/lib/phase-provenance.js';
import {
  LEDGER_RECOVERY_AUTHORITY_FIELDS,
  LEDGER_RECOVERY_PROFILE,
} from './ledger-recovery-profile.js';
import { proofExecutable, readProofInput } from './retrospective-proof.js';

const recovery = '.project/tickets/V2ZPV1-recover-accurate-completion-evidence';
const original = '.project/tickets/5F5ZZA-keep-plan-reviews-current-and-trustworthy';
export const RECOVERY_AUDIT_PATHS = [
  ...[
    'ticket.md',
    'investigation.md',
    'impl-plan.md',
    'test-definitions.md',
    'case-census.json',
    'ledger-reconciliation.json',
    'recovery-manifest.json',
    'evidence-summary.json',
  ].map(name => `${recovery}/${name}`),
  `${original}/ticket.md`,
  `${original}/verify.md`,
] as const;

export function recoveryDigest(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

export function recoveryGit(root: string, args: readonly string[]): Buffer {
  const result = spawnSync(
    proofExecutable(root, 'git', 'Git'),
    ['--no-replace-objects', '-C', root, ...args],
    {
      encoding: 'buffer',
      timeout: 30_000,
      maxBuffer: 128 * 1024 * 1024,
      env: Object.fromEntries(
        Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')),
      ),
    },
  );
  if (result.error !== undefined || result.status !== 0)
    throw new Error('Cannot inspect recovery candidate Git source.');
  return result.stdout;
}

/** Complete committed product identity, with only the reviewed audit exceptions. */
export function recoveryProductTree(root: string): string {
  const entries = recoveryGit(root, ['ls-tree', '-rz', '--full-tree', 'HEAD'])
    .toString()
    .split('\0')
    .filter(Boolean);
  return recoveryDigest(
    entries
      .filter(entry => {
        const path = entry.slice(entry.indexOf('\t') + 1);
        return RECOVERY_AUDIT_PATHS.every(audit => audit !== path);
      })
      .join('\0'),
  );
}

export function assertRecoverySource(root: string): void {
  const changed = recoveryGit(root, ['diff', '--name-only', '-z', 'HEAD'])
    .toString()
    .split('\0')
    .filter(Boolean);
  const untracked = recoveryGit(root, ['ls-files', '--others', '--exclude-standard', '-z'])
    .toString()
    .split('\0')
    .filter(Boolean);
  if (
    [...changed, ...untracked].some(path => RECOVERY_AUDIT_PATHS.every(audit => audit !== path))
  ) {
    throw new Error('Recovery requires committed, clean product and execution inputs.');
  }
  if (
    recoveryDigest(readProofInput(root, LEDGER_RECOVERY_PROFILE.ledger)) !==
    LEDGER_RECOVERY_PROFILE.ledgerSha256
  ) {
    throw new Error('Recovery historical ledger changed.');
  }
  if (
    recoveryDigest(readProofInput(root, LEDGER_RECOVERY_PROFILE.feature)) !==
    LEDGER_RECOVERY_PROFILE.featureSha256
  ) {
    throw new Error('Recovery feature scope changed.');
  }
  const meta = frontmatterOf(
    readProofInput(root, `${original}/ticket.md`).toString().replaceAll('\r\n', '\n'),
  );
  if (meta === undefined) throw new Error('Recovery accepted ticket authority is missing.');
  const authority = Object.fromEntries(
    LEDGER_RECOVERY_AUTHORITY_FIELDS.map(field => [field, meta[field]]),
  );
  if (recoveryDigest(JSON.stringify(authority)) !== LEDGER_RECOVERY_PROFILE.authoritySha256) {
    throw new Error('Recovery accepted ticket authority changed.');
  }
}
