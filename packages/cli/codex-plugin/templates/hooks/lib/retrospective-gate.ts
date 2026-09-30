import { spawnSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import nodePath from 'node:path';

export interface RetrospectiveGateClaim {
  readonly ticketId: string;
  readonly scenario: string;
  readonly ledger: string;
  readonly eligibilityId: string;
  readonly proofId: string;
}

function trustedCommand(projectRoot: string): readonly [string, ...string[]] | undefined {
  const explicit = process.env.SAFEWORD_PLUGIN_CLI?.trim();
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT?.trim();
  const candidate = explicit || (pluginRoot ? nodePath.join(pluginRoot, 'runtime', 'cli.js') : '');
  if (candidate === '') {
    try {
      const version = readFileSync(
        nodePath.join(projectRoot, '.safeword', 'version'),
        'utf8',
      ).trim();
      return /^\d+\.\d+\.\d+$/u.test(version)
        ? ['bunx', '--bun', `safeword@${version}`]
        : undefined;
    } catch {
      return undefined;
    }
  }
  try {
    const cli = realpathSync.native(candidate);
    const project = realpathSync.native(projectRoot);
    const relative = nodePath.relative(project, cli);
    const inside =
      relative === '' ||
      (relative !== '..' &&
        !relative.startsWith(`..${nodePath.sep}`) &&
        !nodePath.isAbsolute(relative));
    if (inside) return undefined;
    return ['bun', cli];
  } catch {
    return undefined;
  }
}

/** Invoke the installed runtime, never a project-writable source file. */
export function retrospectiveGateDenial(
  projectRoot: string,
  claim: RetrospectiveGateClaim,
): string | undefined {
  const command = trustedCommand(projectRoot);
  if (command === undefined) return 'A trusted installed Safeword CLI is unavailable.';
  const [executable, ...prefix] = command;
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
    { cwd: projectRoot, encoding: 'utf8', timeout: 30_000, maxBuffer: 1024 * 1024 },
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
