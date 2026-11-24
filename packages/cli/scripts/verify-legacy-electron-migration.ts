import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

import { electronLedgerClaims } from '../src/review/retrospective-electron-admission.js';
import { SOULLESS_RETROSPECTIVE_POLICY as policy } from '../src/review/retrospective-policy.js';
import { currentProofCommit, proofGit, readProofInput } from '../src/review/retrospective-proof.js';
import {
  pinnedSafewordVersion,
  type SafewordCli,
  trustedEnvironment,
  trustedSafewordClis,
} from '../templates/hooks/lib/safeword-cli.js';

function installedRuntime(root: string): SafewordCli {
  const version = pinnedSafewordVersion(root);
  if (version === undefined)
    throw new Error('The project must pin its installed Safeword version.');
  const profile = process.env.CODEX_HOME || path.join(homedir(), '.codex');
  const bundle = path.posix.join('plugins/cache/safeword/safeword', version);
  const expected = path.join(profile, bundle, 'runtime/cli.js');
  // Require regular installed files, not a project-owned or symlinked source CLI.
  readProofInput(profile, `${bundle}/runtime/cli.js`);
  const metadata = JSON.parse(
    readProofInput(profile, `${bundle}/package.json`).toString('utf8'),
  ) as { name?: unknown; version?: unknown };
  if (metadata.name !== 'safeword-codex-plugin' || metadata.version !== version)
    throw new Error('A supported installed Codex runtime is required.');
  const canonical = realpathSync.native(expected);
  const candidate = trustedSafewordClis(root).find(
    cli => cli.downloads !== true && cli.args.includes(canonical),
  );
  if (candidate === undefined) throw new Error('A supported installed Codex runtime is required.');
  return candidate;
}

interface GateEnvelope {
  schema_version?: unknown;
  ok?: unknown;
  state?: unknown;
  changed?: unknown;
  errors?: unknown;
  findings?: { message?: unknown }[];
  data?: Record<string, unknown>;
}

function approved(
  envelope: GateEnvelope,
  exitCode: number | null,
  identity: Readonly<Record<string, string>>,
): boolean {
  return (
    exitCode === 0 &&
    envelope.schema_version === 1 &&
    envelope.ok === true &&
    envelope.state === 'healthy' &&
    envelope.changed === false &&
    Array.isArray(envelope.errors) &&
    envelope.errors.length === 0 &&
    Object.entries(identity).every(([key, value]) => envelope.data?.[key] === value)
  );
}

function checkGate(
  root: string,
  cli: SafewordCli,
  operation: 'retrospective' | 'retrospective-close',
  identity: Readonly<Record<string, string>>,
): void {
  const options = Object.entries(identity)
    .filter(([name]) => !['command', 'status'].includes(name))
    .flatMap(([name, value]) => [
      `--${({ ticketId: 'ticket', eligibilityId: 'eligibility', proofId: 'proof' } as Record<string, string>)[name] ?? name}`,
      value,
    ]);
  const result = spawnSync(
    cli.command,
    [...cli.args, '--cwd', root, '--json', '--no-input', 'review', 'gate', operation, ...options],
    {
      cwd: cli.cwd,
      env: trustedEnvironment(root),
      encoding: 'utf8',
      timeout: 30_000,
      maxBuffer: 2 * 1024 * 1024,
    },
  );
  let envelope: GateEnvelope;
  try {
    envelope = JSON.parse(result.stdout) as GateEnvelope;
  } catch (error: unknown) {
    throw new Error('The installed gate did not return valid JSON.', { cause: error });
  }
  if (!approved(envelope, result.status, identity)) {
    const reason = Array.isArray(envelope.findings)
      ? envelope.findings
          .map(finding => (typeof finding.message === 'string' ? finding.message : ''))
          .join('; ')
      : 'invalid response';
    throw new Error(
      `Installed ${operation} gate refused ${identity.scenario ?? policy.ticketId}: ${reason || 'response identity or outcome mismatch'}`,
    );
  }
}

/** Read-only delivery evidence: gates alone own authority; this driver creates no receipts. */
export function verifyLegacyElectronMigration(project: string) {
  const root = realpathSync.native(project);
  const gitRoot = proofGit(root, ['rev-parse', '--show-toplevel']).toString('utf8').trim();
  if (realpathSync.native(gitRoot) !== root)
    throw new Error('Delivery verification requires the repository root.');
  const sourceCommit = currentProofCommit(root);
  const claims = electronLedgerClaims(root);
  const headings = new Set(claims.map(claim => claim.scenario));
  if (
    claims.length !== policy.scenarios.length ||
    headings.size !== policy.scenarios.length ||
    policy.scenarios.some(heading => !headings.has(heading))
  )
    throw new Error('Delivery verification requires the exact 17 enrolled VERIFIED rows.');
  const cli = installedRuntime(root);
  const rows = policy.scenarios.map(scenario => {
    const claim = claims.find(candidate => candidate.scenario === scenario);
    if (claim === undefined) throw new Error(`Missing required Electron VERIFIED row: ${scenario}`);
    checkGate(root, cli, 'retrospective', {
      command: 'review gate retrospective',
      status: 'approved',
      ...claim,
    });
    return { ...claim, status: 'approved' };
  });
  checkGate(root, cli, 'retrospective-close', {
    command: 'review gate retrospective-close',
    status: 'approved',
    ticketId: policy.ticketId,
    ledger: policy.ledger,
  });
  if (currentProofCommit(root) !== sourceCommit)
    throw new Error('The project changed during delivery verification.');
  return {
    policyId: policy.id,
    ticketId: policy.ticketId,
    ledger: policy.ledger,
    sourceCommit,
    rows,
    closingStatus: 'approved',
  };
}

if (import.meta.main) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 2 || args[0] !== '--project' || !args[1])
      throw new Error('Usage: verify-legacy-electron-migration.ts --project <repository-root>');
    process.stdout.write(`${JSON.stringify(verifyLegacyElectronMigration(args[1]))}\n`);
  } catch (error: unknown) {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'Delivery verification failed.'}\n`,
    );
    process.exitCode = 1;
  }
}
