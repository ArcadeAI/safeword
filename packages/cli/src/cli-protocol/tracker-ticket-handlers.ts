import { existsSync, readdirSync, readFileSync } from 'node:fs';
import process from 'node:process';

import { resolveTicketsDirectory } from '../utils/configured-paths.js';
import type { CommandInvocation } from './handler.js';
import { effectsFromMutationJournal, type JournalMutation } from './mutation-effects.js';
import { onlineRequired } from './online-required.js';
import { stringOption } from './option-values.js';
import { buildReplayCommand } from './replay-command.js';
import { type CliResult, createResult } from './result.js';

function trackerConnectReplayCommand(provider: string, invocation: CommandInvocation): string {
  return buildReplayCommand({
    command: 'safeword tracker connect',
    operands: [provider],
    options: [
      ['--repo', stringOption(invocation.options, 'repo')],
      ['--team', stringOption(invocation.options, 'team')],
      ['--workspace', stringOption(invocation.options, 'workspace')],
    ],
    cwd: invocation.cwd,
  });
}

function trackerConnectResult(
  provider: string,
  result: {
    readonly exitCode: number;
    readonly connected: boolean;
    readonly mutations: readonly JournalMutation[];
  },
  messages: readonly string[],
  invocation: CommandInvocation,
): CliResult {
  const succeeded = result.exitCode === 0;
  const changed = result.mutations.some(mutation => mutation.surface !== 'network');
  let state: CliResult['state'] = 'failed';
  if (succeeded) state = changed ? 'changed' : 'healthy';
  return createResult({
    state,
    changed,
    effects: effectsFromMutationJournal(result.mutations),
    errors: succeeded
      ? []
      : [
          {
            code: 'TRACKER_CONNECT_FAILED',
            message: messages.at(-1) ?? 'Tracker connection failed.',
            retryable: true,
          },
        ],
    recovery:
      !succeeded && changed
        ? [
            {
              command: trackerConnectReplayCommand(provider, invocation),
              description:
                'Retry verification and finish tracker setup using the persisted configuration.',
              requiresHuman: false,
            },
          ]
        : [],
    data: { command: 'tracker connect', provider, connected: result.connected, messages },
  });
}

async function runTrackerConnect(invocation: CommandInvocation): Promise<CliResult> {
  const provider = invocation.operands[0];
  if (typeof provider !== 'string') {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'TRACKER_PROVIDER_REQUIRED',
          message: 'tracker connect requires a provider.',
          retryable: false,
        },
      ],
    });
  }
  const { runConnect } = await import('../tracker-connect/run.js');
  const { createPrompt } = await import('../tracker-connect/prompt.js');
  const messages: string[] = [];
  const result = await runConnect(
    provider,
    {
      repo: stringOption(invocation.options, 'repo'),
      team: stringOption(invocation.options, 'team'),
      workspace: stringOption(invocation.options, 'workspace'),
    },
    message => {
      messages.push(message);
    },
    {
      cwd: invocation.cwd,
      prompt:
        !invocation.noInput && process.stdin.isTTY
          ? createPrompt()
          : { confirm: () => Promise.resolve(false) },
    },
  );
  return trackerConnectResult(provider, result, messages, invocation);
}

interface TrackerSyncResultInput {
  readonly provider: string | undefined;
  readonly exitCode: number;
  readonly before: string | undefined;
  readonly after: string | undefined;
  readonly messages: readonly string[];
}

function trackerSyncResult(input: TrackerSyncResultInput): CliResult {
  const changed = input.before !== input.after;
  const succeeded = input.exitCode === 0;
  let state: CliResult['state'] = 'failed';
  if (succeeded) state = changed ? 'changed' : 'healthy';
  return createResult({
    state,
    changed,
    effects: {
      files: changed
        ? [
            {
              kind: input.before === undefined ? 'create' : 'update',
              target: '.safeword/tracker-map.json',
            },
          ]
        : [],
      network:
        input.provider === undefined
          ? []
          : [{ kind: 'tracker-sync', target: input.provider, operation: 'read-write' }],
    },
    errors: succeeded
      ? []
      : [
          {
            code: 'TRACKER_SYNC_FAILED',
            message: input.messages.at(-1) ?? 'Tracker synchronization failed.',
            retryable: true,
          },
        ],
    data: {
      command: 'tracker sync',
      provider: input.provider ?? 'none',
      messages: input.messages,
    },
  });
}

async function runOfflineTrackerSync(invocation: CommandInvocation): Promise<CliResult> {
  const { applyTrackerSyncResults, planTrackerSync } = await import('../commands/sync-tracker.js');
  const { readTicketBridgeConfig } = await import('../tracker-sync/config.js');
  const config = readTicketBridgeConfig(invocation.cwd);
  const applyResultsFile = stringOption(invocation.options, 'applyResults');
  const result =
    applyResultsFile === undefined
      ? planTrackerSync(invocation.cwd, config)
      : applyTrackerSyncResults(invocation.cwd, config, applyResultsFile);
  if (!result.ok) {
    return createResult({
      state: 'failed',
      errors: [{ code: 'TRACKER_SYNC_FAILED', message: result.reason, retryable: false }],
      data: { command: 'tracker sync', mode: result.mode, messages: result.messages },
    });
  }
  if (result.mode === 'plan') {
    return createResult({
      state: 'healthy',
      findings: result.messages.map(message => ({
        code: 'TRACKER_SYNC_ADVISORY',
        message,
        severity: 'warning',
      })),
      data: {
        command: 'tracker sync',
        mode: 'plan',
        provider: result.provider ?? 'none',
        plan: result.plan,
      },
    });
  }
  return createResult({
    state: result.changed ? 'changed' : 'healthy',
    changed: result.changed,
    effects: {
      files: result.changed ? [{ kind: 'update', target: '.safeword/tracker-map.json' }] : [],
    },
    data: { command: 'tracker sync', mode: 'apply', provider: result.provider },
  });
}

async function runTrackerSync(invocation: CommandInvocation): Promise<CliResult> {
  const { buildWriterRegistry, resolveRepoVisibility } = await import('../tracker-sync/clients.js');
  const { readTicketBridgeConfig } = await import('../tracker-sync/config.js');
  const { readCorpus } = await import('../tracker-sync/corpus.js');
  const { supportedProvider, syncTracker } = await import('../tracker-sync/index.js');
  const { trackerMapPath } = await import('../tracker-sync/tracker-map.js');
  const { resolveGhCliToken } = await import('../utils/gh-cli.js');

  const config = readTicketBridgeConfig(invocation.cwd);
  const provider = supportedProvider(config.provider);
  const sidecarPath = trackerMapPath(invocation.cwd);
  const before = existsSync(sidecarPath) ? readFileSync(sidecarPath, 'utf8') : undefined;
  const messages: string[] = [];
  const writers =
    provider === undefined
      ? ({} as ReturnType<typeof buildWriterRegistry>)
      : buildWriterRegistry(provider, config.target);
  const repoVisibility =
    provider === 'github' && config.body === 'full'
      ? resolveRepoVisibility(config.target?.repo)
      : undefined;
  const result = await syncTracker({
    config,
    tickets: provider === undefined ? [] : readCorpus(invocation.cwd, config.target?.repo),
    sidecarPath,
    writers,
    env: process.env,
    keychain: candidate => (candidate === 'github' ? resolveGhCliToken(process.env) : undefined),
    resetTrackerMap: invocation.options.resetTrackerMap === true,
    nonInteractive: invocation.noInput,
    repoVisibility,
    log: message => {
      messages.push(message);
    },
  });
  const after = existsSync(sidecarPath) ? readFileSync(sidecarPath, 'utf8') : undefined;
  return trackerSyncResult({ provider, exitCode: result.exitCode, before, after, messages });
}

export function trackerHandler(
  name: 'tracker connect' | 'tracker sync',
  invocation: CommandInvocation,
): Promise<CliResult> {
  const offlineMode =
    name === 'tracker sync' &&
    (invocation.options.plan === true || typeof invocation.options.applyResults === 'string');
  if (offlineMode) return runOfflineTrackerSync(invocation);
  if (invocation.offline) return Promise.resolve(onlineRequired(name));
  invocation.progress?.start(`Running ${name}…`);
  return name === 'tracker connect' ? runTrackerConnect(invocation) : runTrackerSync(invocation);
}

export function ticketListHandler(invocation: CommandInvocation): Promise<CliResult> {
  const ticketsRoot = resolveTicketsDirectory(invocation.cwd);
  const tickets = existsSync(ticketsRoot)
    ? readdirSync(ticketsRoot, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && entry.name !== 'completed')
        .map(entry => entry.name)
        .toSorted((left, right) => left.localeCompare(right))
    : [];
  return Promise.resolve(
    createResult({
      state: 'healthy',
      data: { command: 'ticket list', tickets },
    }),
  );
}

function ticketNewReplayCommand(invocation: CommandInvocation): string {
  const slug = String(invocation.operands[0]);
  const type = stringOption(invocation.options, 'type') ?? 'task';
  return buildReplayCommand({
    command: 'ticket new',
    operands: [slug],
    options: [
      ['--type', type],
      ['--title', stringOption(invocation.options, 'title')],
      ['--goal', stringOption(invocation.options, 'goal')],
      ['--why', stringOption(invocation.options, 'why')],
      ['--parent', stringOption(invocation.options, 'parent')],
      ['--issue', stringOption(invocation.options, 'issue')],
    ],
    cwd: invocation.cwd,
  });
}

export async function ticketNewHandler(invocation: CommandInvocation): Promise<CliResult> {
  if (invocation.offline) {
    const { readTicketBridgeConfig } = await import('../tracker-sync/config.js');
    const config = readTicketBridgeConfig(invocation.cwd);
    if (config.provider === 'github' || config.provider === 'linear') {
      return onlineRequired('ticket new', ticketNewReplayCommand(invocation));
    }
  }
  const { createTicketResult } = await import('../commands/ticket-new.js');
  return createTicketResult(String(invocation.operands[0]), invocation.options, invocation.cwd);
}

export async function ticketReconcileParentHandler(
  invocation: CommandInvocation,
): Promise<CliResult> {
  const { reconcileParentResult } = await import('../commands/ticket-reconcile-parent.js');
  return reconcileParentResult(
    String(invocation.operands[0]),
    { accept: invocation.options.accept === true },
    invocation.cwd,
  );
}
