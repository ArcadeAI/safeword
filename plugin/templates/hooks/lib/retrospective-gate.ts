import { spawnSync } from 'node:child_process';

import { trustedEnvironment, trustedSafewordClis } from './safeword-cli.ts';

export interface RetrospectiveGateClaim {
  readonly ticketId: string;
  readonly scenario: string;
  readonly ledger: string;
  readonly eligibilityId: string;
  readonly proofId: string;
}

/** The first trusted CLI; the shared lookup keeps runtime and script outside the project. */
function trustedCommand(
  projectRoot: string,
): { argv: readonly [string, ...string[]]; cwd: string; timeout: number } | undefined {
  const cli = trustedSafewordClis(projectRoot)[0];
  if (cli === undefined) return undefined;
  // A first `bun x` run may download the pinned package.
  const timeout = cli.downloads === true ? 30_000 : 10_000;
  return { argv: [cli.command, ...cli.args], cwd: cli.cwd, timeout };
}

/** Invoke the installed runtime, never a project-writable source file. */
export function retrospectiveGateDenial(
  projectRoot: string,
  claim: RetrospectiveGateClaim,
): string | undefined {
  const command = trustedCommand(projectRoot);
  if (command === undefined) return 'A trusted installed Safeword CLI is unavailable.';
  const [executable, ...prefix] = command.argv;
  const result = spawnSync(
    executable,
    [
      ...prefix,
      '--json',
      '--no-input',
      '--cwd',
      projectRoot,
      'review',
      'gate',
      'retrospective',
      '--ticket',
      claim.ticketId,
      '--scenario',
      claim.scenario,
      '--ledger',
      claim.ledger,
      '--eligibility',
      claim.eligibilityId,
      '--proof',
      claim.proofId,
    ],
    {
      cwd: command.cwd,
      env: trustedEnvironment(projectRoot),
      encoding: 'utf8',
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
    },
  );
  try {
    const parsed = JSON.parse(result.stdout) as {
      state?: unknown;
      findings?: Array<{ message?: unknown }>;
      data?: Partial<RetrospectiveGateClaim> & { status?: unknown };
    };
    if (
      result.status === 0 &&
      parsed.state === 'healthy' &&
      parsed.data?.status === 'approved' &&
      parsed.data.ticketId === claim.ticketId &&
      parsed.data.scenario === claim.scenario &&
      parsed.data.ledger === claim.ledger &&
      parsed.data.eligibilityId === claim.eligibilityId &&
      parsed.data.proofId === claim.proofId
    )
      return undefined;
    const message = parsed.findings?.find(finding => typeof finding.message === 'string')?.message;
    return typeof message === 'string'
      ? message
      : 'Retrospective review gate did not approve this row.';
  } catch {
    return 'Retrospective review gate could not return a verified result.';
  }
}

/** Closing checks use the signed replay record created by the installed CLI. */
export function retrospectiveCloseDenial(
  projectRoot: string,
  ticketId: string,
  ledger: string,
): string | undefined {
  const command = trustedCommand(projectRoot);
  if (command === undefined) return 'A trusted installed Safeword CLI is unavailable.';
  const [executable, ...prefix] = command.argv;
  const result = spawnSync(
    executable,
    [
      ...prefix,
      '--json',
      '--no-input',
      '--cwd',
      projectRoot,
      'review',
      'gate',
      'retrospective-close',
      '--ticket',
      ticketId,
      '--ledger',
      ledger,
    ],
    {
      cwd: command.cwd,
      env: trustedEnvironment(projectRoot),
      encoding: 'utf8',
      timeout: command.timeout,
      maxBuffer: 1024 * 1024,
    },
  );
  try {
    const parsed = JSON.parse(result.stdout) as {
      state?: unknown;
      findings?: Array<{ message?: unknown }>;
      data?: { status?: unknown; ticketId?: unknown; ledger?: unknown };
    };
    if (
      result.status === 0 &&
      parsed.state === 'healthy' &&
      parsed.data?.status === 'approved' &&
      parsed.data.ticketId === ticketId &&
      parsed.data.ledger === ledger
    )
      return undefined;
    const message = parsed.findings?.find(finding => typeof finding.message === 'string')?.message;
    return typeof message === 'string' ? message : 'Retrospective closing proof is not current.';
  } catch {
    return 'Retrospective closing proof could not return a verified result.';
  }
}
