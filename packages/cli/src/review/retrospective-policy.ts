import { inspectHistoryGit } from './retrospective-history-core.js';

export interface RetrospectiveMigrationPolicy {
  readonly id: string;
  readonly ticketId: 'CKWE2D' | 'SGWMBS';
  readonly cutoff: string;
  readonly ledger: string;
  readonly feature: string;
  readonly runner: 'bun-vitest' | 'playwright-electron';
  readonly repository?: string;
}

export const LEGACY_RETROSPECTIVE_POLICY = {
  id: 'ckwe2d-authored-inputs-v1',
  ticketId: 'CKWE2D',
  cutoff: '690536ec56c07c2b042108d9c31d28bc3bc82619',
  ledger: '.project/tickets/CKWE2D-keep-reviews-focused-on-authored-inputs/test-definitions.md',
  feature: 'packages/cli/features/keep-reviews-focused-on-authored-inputs.feature',
  runner: 'bun-vitest',
} as const satisfies RetrospectiveMigrationPolicy;

export const SOULLESS_RETROSPECTIVE_POLICY = {
  id: 'soulless-electron-20261123-v1',
  ticketId: 'SGWMBS',
  cutoff: '4990ae4158d3e2744a8c5934089a8e1d5d2b19b1',
  ledger: '.project/tickets/SGWMBS-open-save-soul-electron/test-definitions.md',
  feature: 'features/open-save-soul-electron.feature',
  runner: 'playwright-electron',
  repository: 'github.com/arcadeai/soulless-monorepo',
} as const satisfies RetrospectiveMigrationPolicy;

/** Enrollment is compiled source; project configuration cannot add a policy. */
export function retrospectivePolicy(ticketId: string): RetrospectiveMigrationPolicy | undefined {
  if (ticketId === LEGACY_RETROSPECTIVE_POLICY.ticketId) return LEGACY_RETROSPECTIVE_POLICY;
  if (ticketId === SOULLESS_RETROSPECTIVE_POLICY.ticketId) return SOULLESS_RETROSPECTIVE_POLICY;
  return undefined;
}

function canonicalRepo(remote: string): string | undefined {
  const ssh = /^git@github\.com:(.+)$/iu.exec(remote.trim());
  if (ssh?.[1] !== undefined)
    return `github.com/${ssh[1]
      .replace(/\/?$/u, '')
      .replace(/\.git$/iu, '')
      .toLowerCase()}`;
  try {
    const url = new URL(remote.trim());
    if (
      !['https:', 'ssh:'].includes(url.protocol) ||
      url.hostname !== 'github.com' ||
      url.port !== ''
    )
      return undefined;
    return `github.com/${url.pathname
      .replace(/^\//u, '')
      .replace(/\/$/u, '')
      .replace(/\.git$/iu, '')
      .toLowerCase()}`;
  } catch {
    return undefined;
  }
}

/** Legacy enrollment keeps its original ancestry-only repository boundary. */
export function matchesMigrationOrigin(
  root: string,
  policy: RetrospectiveMigrationPolicy,
): boolean {
  if (policy.repository === undefined) return true;
  const remote = inspectHistoryGit(root, ['config', '--get', 'remote.origin.url']);
  return !remote.error && remote.status === 0 && canonicalRepo(remote.stdout) === policy.repository;
}
