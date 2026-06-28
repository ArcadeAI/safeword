/**
 * Provider routing for `ticket new` (KKNFZA TB1.AC1). A pure decision over the
 * ticketBridge config + command options: provider:none (or an unsupported
 * provider — sync-tracker AC1 parity) stays on the local-id path; a configured
 * GitHub/Linear provider goes issue-first, adopting an existing key when
 * `--issue` is given, otherwise creating. No fs, no network — the caller builds
 * the identity source from this decision.
 */

const ISSUE_FIRST_PROVIDERS = new Set(['github', 'linear']);

export type CreationMode = { mode: 'local' } | { mode: 'create' } | { mode: 'adopt'; key: string };

export function resolveCreationMode(
  config: { provider: string },
  options: { issue?: string },
): CreationMode {
  if (!ISSUE_FIRST_PROVIDERS.has(config.provider)) return { mode: 'local' };
  if (options.issue !== undefined && options.issue !== '') {
    return { mode: 'adopt', key: options.issue };
  }
  return { mode: 'create' };
}
