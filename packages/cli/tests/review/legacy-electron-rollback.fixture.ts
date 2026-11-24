import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { electronLedgerClaims } from '../../src/review/retrospective-electron-admission.js';
import { SOULLESS_RETROSPECTIVE_POLICY as policy } from '../../src/review/retrospective-policy.js';
import { proofExecutable, proofGit } from '../../src/review/retrospective-proof.js';

const BASELINE = '3f5353165447d6c5565dcc1c8b077f0c76d03c7f';
const BUNDLE = 'packages/cli/codex-plugin';

function recordDigests(root: string): string {
  const entries: [string, string][] = [];
  const visit = (directory: string) => {
    const children = readdirSync(directory, { withFileTypes: true });
    for (const entry of children) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile())
        entries.push([file, createHash('sha256').update(readFileSync(file)).digest('hex')]);
      else throw new Error('Rollback comparison requires regular review records.');
    }
  };
  visit(path.join(root, '.safeword/state/reviews'));
  return JSON.stringify(entries.toSorted(([left], [right]) => left.localeCompare(right, 'en')));
}

/** Executes the actual old generated distribution; never replaces an installed plugin. */
// eslint-disable-next-line complexity -- The portable and explicit live modes share extraction, refusal, and preservation checks.
export function legacyElectronRollback() {
  const source = path.resolve(import.meta.dirname, '../../../..');
  const temporary = mkdtempSync(path.join(tmpdir(), 'safeword-electron-rollback-'));
  const realProject = process.env.SGWMBS_ROLLBACK_PROJECT;
  const root = realProject ?? path.join(temporary, 'repository');
  const bun = proofExecutable(source, 'bun', 'Bun');
  try {
    const runtimeBlob = proofGit(source, ['rev-parse', `${BASELINE}:${BUNDLE}/runtime/cli.js`])
      .toString('utf8')
      .trim();
    const archive = proofGit(source, ['archive', '--format=tar', BASELINE, BUNDLE]);
    const extracted = spawnSync(
      proofExecutable(source, 'tar', 'Tar'),
      ['-xf', '-', '-C', temporary],
      { input: archive, encoding: 'buffer', timeout: 30_000 },
    );
    if (extracted.status !== 0) throw new Error('Cannot extract the pinned old plugin bundle.');
    if (realProject === undefined) {
      const records = path.join(root, '.safeword/state/reviews');
      mkdirSync(records, { recursive: true });
      // Deliberately synthetic new-policy shapes. No live profile key or receipt is read.
      writeFileSync(
        path.join(records, 'electron-retrospective-close-v1.json'),
        JSON.stringify({ ticketId: policy.ticketId, policyId: policy.id, integrity: 'test-only' }),
      );
      writeFileSync(
        path.join(records, 'electron-row-test.tag'),
        JSON.stringify({ ticketId: policy.ticketId, scenario: policy.scenarios[2] }),
      );
    } else {
      const preflight = spawnSync(
        bun,
        [
          path.resolve(import.meta.dirname, '../../scripts/verify-legacy-electron-migration.ts'),
          '--project',
          root,
        ],
        { encoding: 'utf8', timeout: 240_000 },
      );
      if (preflight.status !== 0)
        throw new Error(`Current real all-row authorization is required: ${preflight.stderr}`);
    }
    const before = recordDigests(root);
    const invoke = (operation: string, options: readonly string[]) => {
      const result = spawnSync(
        bun,
        [
          path.join(temporary, BUNDLE, 'runtime/cli.js'),
          '--cwd',
          root,
          '--json',
          '--no-input',
          'review',
          'gate',
          operation,
          '--ticket',
          policy.ticketId,
          '--ledger',
          policy.ledger,
          ...options,
        ],
        { encoding: 'utf8', timeout: 30_000 },
      );
      const envelope = JSON.parse(result.stdout) as {
        data: { status: string };
        findings: { message: string }[];
      };
      if (
        result.status === 0 ||
        envelope.data.status !== 'blocked' ||
        envelope.findings.every(finding => !finding.message.includes('CKWE2D'))
      )
        throw new Error(
          `Pinned old bundle did not explicitly refuse the new policy: ${result.stdout}`,
        );
      return envelope;
    };
    const claim = realProject === undefined ? undefined : electronLedgerClaims(root)[0];
    if (realProject !== undefined && claim === undefined)
      throw new Error('Real rollback comparison requires an authentic enrolled row.');
    const row = invoke('retrospective', [
      '--scenario',
      claim?.scenario ?? policy.scenarios[2],
      '--eligibility',
      claim?.eligibilityId ?? '11111111-1111-4111-8111-111111111111',
      '--proof',
      claim?.proofId ?? '22222222-2222-4222-8222-222222222222',
    ]);
    const close = invoke('retrospective-close', []);
    return { runtimeBlob, row, close, unchanged: recordDigests(root) === before };
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}
