import { spawnSync } from 'node:child_process';
import nodePath from 'node:path';

import { runtimeEnvironment, trustedCommand } from './retrospective-gate.js';

export interface RecoveryClosingView {
  historicalView: string;
  deferredCases: { name: string; status: string }[];
}

/** Supported local boundaries ask the trusted installed runtime for current authority. */
export function recoveryClosingView(
  projectRoot: string,
  ticketDirectory: string,
  host?: string,
): RecoveryClosingView | undefined {
  if (!['claude', 'codex', 'cursor'].includes(host ?? '')) return undefined;
  const ledger =
    '.project/tickets/5F5ZZA-keep-plan-reviews-current-and-trustworthy/test-definitions.md';
  if (
    nodePath.relative(projectRoot, nodePath.join(ticketDirectory, 'test-definitions.md')) !== ledger
  )
    return undefined;
  const command = trustedCommand(projectRoot);
  if (command === undefined) return undefined;
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
      'ledger-recovery',
      '--ticket',
      '5F5ZZA',
    ],
    {
      cwd: nodePath.dirname(prefix.at(-1) ?? executable),
      env: runtimeEnvironment(),
      encoding: 'utf8',
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
    },
  );
  return result.status === 0 ? parseRecoveryClosingView(result.stdout, ledger) : undefined;
}

function parseRecoveryClosingView(stdout: string, ledger: string): RecoveryClosingView | undefined {
  try {
    const parsed = JSON.parse(stdout) as {
      state?: string;
      data?: {
        status?: string;
        ticket?: string;
        ledger?: string;
        historicalView?: string;
        summary?: { activeCases?: string[]; deferredCases?: { name: string; status: string }[] };
      };
    };
    const data = parsed.data;
    const deferred = data?.summary?.deferredCases;
    if (data === undefined || deferred === undefined) return undefined;
    const approved = [
      parsed.state === 'healthy',
      data.status === 'approved',
      data.ticket === '5F5ZZA',
      data.ledger === ledger,
      typeof data.historicalView === 'string',
      data.summary?.activeCases?.length === 142,
      deferred.length === 33,
      deferred.every(item => item.status === 'deferred-unverified'),
    ].every(Boolean);
    if (!approved || typeof data.historicalView !== 'string') return undefined;
    return { historicalView: data.historicalView, deferredCases: deferred };
  } catch {
    return undefined;
  }
}
