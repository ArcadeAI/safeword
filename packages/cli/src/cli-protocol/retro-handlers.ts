/**
 * Handlers for the `retro` command family and the relay recovery commands.
 *
 * A sibling module rather than inline in public-handlers.ts, matching
 * tracker-ticket-handlers.ts: the routing table stays in one place while each
 * domain owns its handlers. Heavy implementations stay behind dynamic imports
 * so the dispatch layer remains cheap to load.
 */

import nodePath from 'node:path';

import type { RetroCliOptions, RetroCommandExecution } from '../commands/retro.js';
import { observedFileEffect, observeFile } from './file-snapshot.js';
import type { CommandInvocation } from './handler.js';
import { withLegacyRawJsonGuidance } from './legacy-raw-json.js';
import { onlineRequired } from './online-required.js';
import { numericOption, stringOption } from './option-values.js';
import { type CliResult, createResult } from './result.js';

export async function retroSignalsHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { formatIssueDrafts, readReports, summarizeReports } =
    await import('../../templates/hooks/lib/self-report.js');
  const records = readReports(invocation.cwd);
  const groups = summarizeReports(records);
  const format = stringOption(invocation.options, 'format') ?? 'human';
  if (!['human', 'json', 'issue'].includes(format)) {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'SELF_REPORT_FORMAT_INVALID',
          message: `Unknown self-report format: ${format}.`,
          retryable: false,
        },
      ],
    });
  }
  let presentation: CliResult['presentation'];
  switch (format) {
    case 'human': {
      const body =
        records.length === 0
          ? 'No safeword self-reports captured. (Nothing to report — good.)'
          : [
              `Safeword self-reports (${records.length} signal(s), ${groups.length} signature(s))`,
              ...groups.map(group => `- ${group.count}×  ${group.signature}`),
            ].join('\n');
      presentation = { kind: 'raw', body };
      break;
    }
    case 'issue': {
      presentation = {
        kind: 'raw',
        body: JSON.stringify(formatIssueDrafts(records), undefined, 2),
      };
      break;
    }
    case 'json': {
      presentation = {
        kind: 'raw',
        body: JSON.stringify({ total: records.length, groups }, undefined, 2),
      };
      break;
    }
  }
  const result = createResult({
    state: 'healthy',
    presentation,
    data: {
      command: 'retro signals',
      total: records.length,
      groups,
      ...(format === 'issue' && { issues: formatIssueDrafts(records) }),
    },
  });
  return withLegacyRawJsonGuidance(result, invocation.options, 'retro signals');
}

function retroFailure(message: string): CliResult {
  return createResult({
    state: 'failed',
    errors: [{ code: 'RETRO_COMMAND_FAILED', message, retryable: true }],
  });
}

interface RelayCommandMessages {
  readonly errors: string[];
  readonly info: string[];
  readonly success: string[];
}

function relayCommandMessages(): RelayCommandMessages & {
  readonly output: {
    readonly error: (message: string) => void;
    readonly info: (message: string) => void;
    readonly success: (message: string) => void;
  };
} {
  const errors: string[] = [];
  const info: string[] = [];
  const success: string[] = [];
  return {
    errors,
    info,
    success,
    output: {
      error: message => {
        errors.push(message);
      },
      info: message => {
        info.push(message);
      },
      success: message => {
        success.push(message);
      },
    },
  };
}

async function relayRecoveryDirectory(cwd: string): Promise<CliResult | string> {
  const { resolveRelayRecoveryOutboxDirectory } = await import('../commands/retro.js');
  const outbox = resolveRelayRecoveryOutboxDirectory(
    cwd,
    globalThis.process.env.SAFEWORD_RETRO_RELAY_OUTBOX,
  );
  if (!('error' in outbox)) return outbox.directory;
  return createResult({
    state: 'failed',
    errors: [{ code: 'RETRO_RELAY_OUTBOX_INVALID', message: outbox.error, retryable: false }],
  });
}

function relayRecoveryFromEnvironment(offline: boolean):
  | {
      credential: string;
      fetch: typeof fetch;
      operatorCredential?: string;
      relayUrl: string;
    }
  | undefined {
  if (offline) return undefined;
  const credential = globalThis.process.env.SAFEWORD_RETRO_RELAY_CREDENTIAL?.trim();
  const relayUrl = globalThis.process.env.SAFEWORD_RETRO_RELAY_URL?.trim();
  if (!credential || !relayUrl) return undefined;
  const operatorCredential =
    globalThis.process.env.SAFEWORD_RETRO_RELAY_OPERATOR_CREDENTIAL?.trim();
  return {
    credential,
    fetch,
    ...(operatorCredential && { operatorCredential }),
    relayUrl,
  };
}

function relayCommandFindings(messages: RelayCommandMessages): CliResult['findings'] {
  return [...messages.info, ...messages.success].map((message, index) => ({
    code: index < messages.info.length ? 'RETRO_RELAY_STATUS' : 'RETRO_RELAY_RECOVERED',
    message,
    severity: 'info' as const,
  }));
}

function relayCommandFailure(
  command: 'retro-relay-discard' | 'retro-relay-retry',
  message: string,
  requestId?: string,
): CliResult {
  return createResult({
    state: 'failed',
    errors: [
      {
        code:
          command === 'retro-relay-retry'
            ? 'RETRO_RELAY_RETRY_FAILED'
            : 'RETRO_RELAY_DISCARD_FAILED',
        message,
        retryable: command === 'retro-relay-retry',
      },
    ],
    data: { command, ...(requestId && { request_id: requestId }) },
  });
}

function relayRetryResult(
  requestId: string | undefined,
  succeeded: boolean,
  messages: RelayCommandMessages,
): CliResult {
  const changed = succeeded && requestId !== undefined;
  const recoveredThroughRelay = messages.success.some(message => message.includes('recovered'));
  let state: CliResult['state'] = 'failed';
  if (succeeded) state = changed ? 'changed' : 'healthy';
  return createResult({
    state,
    changed,
    findings: relayCommandFindings(messages),
    effects: {
      configuration:
        changed && !recoveredThroughRelay
          ? [{ kind: 'rearm', target: `Retro relay request ${requestId}`, operation: 'retry' }]
          : [],
      network: recoveredThroughRelay
        ? [{ kind: 'retro-relay-recovery', target: 'Configured retro relay', operation: 'retry' }]
        : [],
    },
    errors: messages.errors.map(message => ({
      code: 'RETRO_RELAY_RETRY_FAILED',
      message,
      retryable: true,
    })),
    data: { command: 'retro-relay-retry', ...(requestId && { request_id: requestId }) },
  });
}

export async function retroRelayRetryHandler(invocation: CommandInvocation): Promise<CliResult> {
  const requestId = invocation.operands[0];
  if (requestId !== undefined && (typeof requestId !== 'string' || !isRelayRequestId(requestId))) {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'CLI_ARGUMENT_INVALID',
          message: 'retro-relay-retry request identity must be a lowercase UUIDv4.',
          retryable: false,
        },
      ],
      data: { command: 'retro-relay-retry' },
    });
  }
  const directory = await relayRecoveryDirectory(invocation.cwd);
  if (typeof directory !== 'string') return directory;
  const messages = relayCommandMessages();
  const { retryRelayDeadLetterCommand } = await import('../commands/retro.js');
  const relay = relayRecoveryFromEnvironment(invocation.offline);
  let succeeded: boolean;
  try {
    succeeded = await retryRelayDeadLetterCommand(requestId, {
      output: messages.output,
      projectDirectory: directory,
      ...(relay && { relay }),
    });
  } catch (error: unknown) {
    return relayCommandFailure(
      'retro-relay-retry',
      error instanceof Error ? error.message : String(error),
      requestId,
    );
  }
  return relayRetryResult(requestId, succeeded, messages);
}

export async function retroRelayDiscardHandler(invocation: CommandInvocation): Promise<CliResult> {
  const requestId = invocation.operands[0];
  if (typeof requestId !== 'string' || !isRelayRequestId(requestId)) {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'CLI_ARGUMENT_INVALID',
          message: 'retro-relay-discard requires one lowercase UUIDv4 request identity.',
          retryable: false,
        },
      ],
      data: { command: 'retro-relay-discard' },
    });
  }
  if (invocation.options.confirm !== true) {
    return createResult({
      state: 'action_required',
      findings: [
        {
          code: 'CONFIRMATION_REQUIRED',
          message: 'Confirm irreversible deletion of this exact durable request identity.',
          severity: 'warning',
        },
      ],
      nextActions: [
        {
          command: `safeword retro-relay-discard ${requestId} --confirm`,
          mutates: true,
          requiresHuman: true,
        },
      ],
      data: { command: 'retro-relay-discard', request_id: requestId },
    });
  }
  const directory = await relayRecoveryDirectory(invocation.cwd);
  if (typeof directory !== 'string') return directory;
  const messages = relayCommandMessages();
  const { discardRelaySpoolCommand } = await import('../commands/retro.js');
  let succeeded: boolean;
  try {
    succeeded = await discardRelaySpoolCommand(requestId, true, {
      output: messages.output,
      projectDirectory: directory,
    });
  } catch (error: unknown) {
    return relayCommandFailure(
      'retro-relay-discard',
      error instanceof Error ? error.message : String(error),
      requestId,
    );
  }
  return createResult({
    state: succeeded ? 'changed' : 'failed',
    changed: succeeded,
    findings: relayCommandFindings(messages),
    effects: {
      destructive: succeeded
        ? [{ kind: 'discard', target: `Retro relay request ${requestId}`, operation: 'delete' }]
        : [],
    },
    errors: messages.errors.map(message => ({
      code: 'RETRO_RELAY_DISCARD_FAILED',
      message,
      retryable: false,
    })),
    data: { command: 'retro-relay-discard', request_id: requestId },
  });
}

function isRelayRequestId(value: string): boolean {
  return /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/u.test(value);
}

function retroOptions(invocation: CommandInvocation, transcript: string): RetroCliOptions {
  const findings = stringOption(invocation.options, 'findings');
  return {
    transcript: nodePath.resolve(invocation.cwd, transcript),
    findings: findings === undefined ? undefined : nodePath.resolve(invocation.cwd, findings),
    autoExtract: invocation.options.autoExtract === true,
    publicRetro: invocation.options.publicRetro === true,
    windowStart: numericOption(invocation.options, 'windowStart'),
    sessionId: stringOption(invocation.options, 'sessionId'),
  };
}

function retroDropFindings(execution: RetroCommandExecution): CliResult['findings'] {
  const drops = execution.outcome.drops;
  if (drops === undefined || drops.schema + drops.surface === 0) return [];
  return [
    {
      code: 'RETRO_FINDINGS_DROPPED',
      message: 'Some findings were rejected by the egress safety boundary.',
      severity: 'warning',
    },
  ];
}

function retroMutationCount(execution: RetroCommandExecution): number {
  const result = execution.outcome.result;
  if (result === undefined) return 0;
  return result.created.length + result.bumped.length + result.commented.length;
}

function retroNetworkEffects(execution: RetroCommandExecution): CliResult['effects']['network'] {
  if (execution.outcome.result === undefined) return [];
  return [{ kind: 'retro-triage', target: 'GitHub', operation: 'read-write' }];
}

function retroRunFailureMessage(execution: RetroCommandExecution): string | undefined {
  if (execution.outcome.ok) {
    return execution.extractionSucceeded ? undefined : 'Retro extraction failed.';
  }
  return execution.outcome.errorMessage ?? 'Retro execution failed.';
}

function retroRunState(failureMessage: string | undefined, changed: boolean): CliResult['state'] {
  if (failureMessage !== undefined) return 'failed';
  return changed ? 'changed' : 'healthy';
}

function retroRunResult(
  execution: RetroCommandExecution,
  fileEffects: CliResult['effects']['files'],
): CliResult {
  const result = execution.outcome.result;
  const changed = retroMutationCount(execution) > 0 || fileEffects.length > 0;
  const failureMessage = retroRunFailureMessage(execution);
  const errors: CliResult['errors'][number][] = [];
  if (failureMessage !== undefined) {
    errors.push({ code: 'RETRO_COMMAND_FAILED', message: failureMessage, retryable: true });
  }
  return createResult({
    state: retroRunState(failureMessage, changed),
    changed,
    effects: { files: fileEffects, network: retroNetworkEffects(execution) },
    findings: retroDropFindings(execution),
    errors,
    data: {
      command: 'retro run',
      result,
      agent_filing_needed: execution.outcome.agentFilingNeeded ?? false,
    },
  });
}

export async function retroRunHandler(invocation: CommandInvocation): Promise<CliResult> {
  if (invocation.offline) return onlineRequired('retro run');
  const transcript = stringOption(invocation.options, 'transcript');
  if (transcript === undefined) return retroFailure('retro run requires --transcript <path>.');

  const options = retroOptions(invocation, transcript);
  const { draftSpoolPath } = await import('../../templates/hooks/lib/retro-draft-spool.js');
  const sessionId = options.sessionId ?? process.env.CLAUDE_SESSION_ID ?? 'unknown';
  const spoolPath = draftSpoolPath(invocation.cwd, sessionId);
  const spoolBefore = observeFile(spoolPath);
  const { executeRetroCommand } = await import('../commands/retro.js');
  invocation.progress?.start('Extracting and filing retro findings…');
  let execution;
  try {
    execution = await executeRetroCommand(options, invocation.cwd);
  } catch (error: unknown) {
    return retroFailure(error instanceof Error ? error.message : String(error));
  }
  return retroRunResult(execution, observedFileEffect(invocation.cwd, spoolPath, spoolBefore));
}

export async function retroReconcileHandler(invocation: CommandInvocation): Promise<CliResult> {
  if (invocation.offline) return onlineRequired('retro reconcile');
  const { executeRetroReconcile } = await import('../commands/retro.js');
  invocation.progress?.start('Reconciling retro findings…');
  let execution;
  try {
    execution = await executeRetroReconcile();
  } catch (error: unknown) {
    return retroFailure(error instanceof Error ? error.message : String(error));
  }
  if (!execution.ok) return retroFailure(execution.reason);
  const changed = execution.result.flagged.length > 0;
  return createResult({
    state: changed ? 'changed' : 'healthy',
    changed,
    effects: {
      network: [{ kind: 'retro-reconcile', target: 'GitHub', operation: 'read-write' }],
    },
    findings: execution.result.failed.map(issue => ({
      code: 'RETRO_RECONCILE_PARTIAL_FAILURE',
      message: `Retro issue ${issue} could not be reconciled.`,
      severity: 'warning',
    })),
    data: { command: 'retro reconcile', result: execution.result },
  });
}
