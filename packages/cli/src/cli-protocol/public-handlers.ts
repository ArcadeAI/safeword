import { existsSync, readdirSync } from 'node:fs';
import nodePath from 'node:path';

import type { CommandHandler, CommandInvocation } from './handler.js';
import { type CliResult, createResult } from './result.js';

function onlineRequired(name: string): CliResult {
  return createResult({
    state: 'action_required',
    findings: [
      {
        code: 'CLI_ONLINE_REQUIRED',
        message: `\`${name}\` requires declared network access for this operation.`,
        severity: 'warning',
      },
    ],
    nextActions: [
      {
        command: `safeword ${name}`,
        mutates: true,
        requiresHuman: false,
      },
    ],
    data: { command: name, offline: true },
  });
}

function notConfigured(command: string): CliResult {
  return createResult({
    state: 'action_required',
    findings: [
      {
        code: 'PROJECT_NOT_CONFIGURED',
        message: 'Safeword is not configured in this project.',
        severity: 'warning',
      },
    ],
    nextActions: [{ command: 'safeword setup', mutates: true, requiresHuman: false }],
    data: { command },
  });
}

type ConfigInspection =
  { readonly matches: true } | { readonly matches: false; readonly reason: 'missing' | 'drifted' };

function configCheckResult(inspection: ConfigInspection): CliResult {
  if (inspection.matches) {
    return createResult({
      state: 'healthy',
      data: { command: 'project sync-config', in_sync: true },
    });
  }
  const driftCode = inspection.reason === 'missing' ? 'CONFIG_MISSING' : 'CONFIG_DRIFTED';
  return createResult({
    state: 'action_required',
    findings: [
      {
        code: driftCode,
        message: 'Dependency-cruiser configuration needs regeneration.',
        severity: 'warning',
      },
    ],
    nextActions: [
      {
        command: 'safeword project sync-config',
        mutates: true,
        requiresHuman: false,
      },
    ],
    data: { command: 'project sync-config', in_sync: false },
  });
}

async function statusHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { observeStatus } = await import('../commands/status.js');
  return observeStatus(invocation.cwd);
}

async function setupHandler(invocation: CommandInvocation): Promise<CliResult> {
  if (invocation.offline && process.env.SAFEWORD_SKIP_INSTALL === undefined) {
    return onlineRequired('setup');
  }
  const { convergeSetup } = await import('../commands/converge-setup.js');
  return convergeSetup(invocation.cwd, { noModify: invocation.options.modify === false });
}

async function planHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { observePlan } = await import('../commands/plan.js');
  return observePlan(invocation.cwd);
}

async function removeHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { removeProject } = await import('../commands/remove.js');
  return removeProject(invocation.cwd, {
    full: invocation.options.full === true,
    yes: invocation.options.yes === true,
    plan: typeof invocation.options.plan === 'string' ? invocation.options.plan : undefined,
  });
}

async function syncConfigHandler(invocation: CommandInvocation): Promise<CliResult> {
  const safewordDirectory = nodePath.join(invocation.cwd, '.safeword');
  if (!existsSync(safewordDirectory)) return notConfigured('project sync-config');

  const { buildArchitecture, inspectConfig, syncConfigCore } =
    await import('../commands/sync-config.js');
  const architecture = buildArchitecture(invocation.cwd);
  const before = inspectConfig(invocation.cwd, architecture);
  if (invocation.options.check === true) return configCheckResult(before);

  if (before.matches && existsSync(nodePath.join(invocation.cwd, '.dependency-cruiser.cjs'))) {
    return createResult({
      state: 'healthy',
      data: { command: 'project sync-config', in_sync: true },
    });
  }

  const synced = syncConfigCore(invocation.cwd, architecture);
  const files = [
    ...(synced.generatedConfig
      ? [
          {
            kind: before.matches ? 'update' : 'create',
            target: '.safeword/depcruise-config.cjs',
          },
        ]
      : []),
    ...(synced.createdMainConfig ? [{ kind: 'create', target: '.dependency-cruiser.cjs' }] : []),
  ];
  return createResult({
    state: files.length === 0 ? 'healthy' : 'changed',
    effects: { files },
    data: { command: 'project sync-config', in_sync: true },
  });
}

async function architectureHandler(invocation: CommandInvocation): Promise<CliResult> {
  if (!existsSync(nodePath.join(invocation.cwd, '.safeword'))) {
    return notConfigured('project architecture');
  }
  const { isWouldChangeAction, planSelfHealProject, selfHealProject } =
    await import('../utils/architecture-document.js');
  const planned = planSelfHealProject(invocation.cwd);
  const stale = planned.filter(action => isWouldChangeAction(action));
  if (invocation.options.check === true) {
    return createResult({
      state: stale.length === 0 ? 'healthy' : 'action_required',
      findings:
        stale.length === 0
          ? []
          : [
              {
                code: 'ARCHITECTURE_DRIFT',
                message: `Architecture documents are stale (${stale.join(', ')}).`,
                severity: 'warning',
              },
            ],
      nextActions:
        stale.length === 0
          ? []
          : [
              {
                command: 'safeword project architecture',
                mutates: true,
                requiresHuman: false,
              },
            ],
      data: { command: 'project architecture', planned: stale },
    });
  }
  const results = selfHealProject(invocation.cwd);
  const changed = results.filter(result => isWouldChangeAction(result.action));
  return createResult({
    state: changed.length === 0 ? 'healthy' : 'changed',
    effects: {
      files: changed.map(result => ({
        kind: result.action,
        target: nodePath.relative(invocation.cwd, result.path),
      })),
    },
    findings:
      invocation.options.stage === true && changed.length > 0
        ? [
            {
              code: 'ARCHITECTURE_STAGE_REQUIRED',
              message: 'Architecture files changed; stage them with git add.',
              severity: 'warning',
            },
          ]
        : [],
    data: { command: 'project architecture' },
  });
}

async function syncLearningsHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { syncLearnings } = await import('../learning-sync/index.js');
  const result = syncLearnings(invocation.cwd);
  return createResult({
    state: result.wrote ? 'changed' : 'healthy',
    effects: {
      files: result.wrote
        ? [
            {
              kind: 'write',
              target: nodePath.relative(invocation.cwd, result.indexPath),
            },
          ]
        : [],
    },
    findings: result.skipped.map(skip => ({
      code: 'LEARNING_SKIPPED',
      message: `Skipped ${skip.fileName}: ${skip.reason}`,
      severity: 'warning' as const,
    })),
    data: { command: 'project sync-learnings', entries: result.entries.length },
  });
}

async function syncTicketsHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { syncTickets } = await import('../ticket-sync/index.js');
  const result = syncTickets(invocation.cwd);
  return createResult({
    state: result.wrote ? 'changed' : 'healthy',
    effects: {
      files: result.wrote
        ? [result.indexPath, result.completedIndexPath].map(target => ({
            kind: 'write',
            target: nodePath.relative(invocation.cwd, target),
          }))
        : [],
    },
    findings: result.skipped.map(skip => ({
      code: 'TICKET_SKIPPED',
      message: `Skipped ${skip.folder}: ${skip.reason}`,
      severity: 'warning' as const,
    })),
    data: {
      command: 'project sync-tickets',
      active: result.active.length,
      completed: result.completed.length,
    },
  });
}

async function codifyHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { codifyResult } = await import('../commands/codify.js');
  const ticket = invocation.operands[0];
  return codifyResult(invocation.cwd, typeof ticket === 'string' ? ticket : '', invocation.options);
}

async function testPlanHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { observeTestPlan } = await import('../commands/test-plan.js');
  return observeTestPlan(
    invocation.cwd,
    invocation.operands[0] as string | undefined,
    invocation.options,
  );
}

async function lintGherkinHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { observeGherkinLint } = await import('../commands/lint-gherkin.js');
  return observeGherkinLint(
    invocation.cwd,
    (invocation.operands[0] as readonly string[] | undefined) ?? [],
  );
}

function trackerHandler(
  name: 'tracker connect' | 'tracker sync',
  invocation: CommandInvocation,
): Promise<CliResult> {
  if (invocation.offline) return Promise.resolve(onlineRequired(name));
  return Promise.resolve(
    createResult({
      state: 'action_required',
      findings: [
        {
          code: 'TRACKER_CONFIRMATION_REQUIRED',
          message: `Review tracker credentials and run \`${name}\` interactively.`,
          severity: 'warning',
        },
      ],
      nextActions: [{ command: `safeword ${name}`, mutates: true, requiresHuman: true }],
      data: { command: name },
    }),
  );
}

async function codexStatusHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { observeCodexMigration } = await import('../commands/migrate-codex-plugin.js');
  return observeCodexMigration(invocation.cwd);
}

function codexMutationHandler(name: string, invocation: CommandInvocation): Promise<CliResult> {
  if (invocation.offline) return Promise.resolve(onlineRequired(name));
  return Promise.resolve(
    createResult({
      state: 'action_required',
      findings: [
        {
          code: 'CODEX_CONFIRMATION_REQUIRED',
          message: `Review the Codex migration state before running \`${name}\`.`,
          severity: 'warning',
        },
      ],
      nextActions: [{ command: `safeword ${name}`, mutates: true, requiresHuman: true }],
      data: { command: name },
    }),
  );
}

function ticketListHandler(invocation: CommandInvocation): Promise<CliResult> {
  const ticketsRoot = nodePath.join(invocation.cwd, '.project', 'tickets');
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

async function retroSignalsHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { readReports, summarizeReports } =
    await import('../../templates/hooks/lib/self-report.js');
  const records = readReports(invocation.cwd);
  return createResult({
    state: 'healthy',
    data: {
      command: 'retro signals',
      total: records.length,
      groups: summarizeReports(records),
    },
  });
}

function networkRetroHandler(name: string, invocation: CommandInvocation): Promise<CliResult> {
  if (invocation.offline) return Promise.resolve(onlineRequired(name));
  const transcript = invocation.options.transcript;
  if (name === 'retro run' && (typeof transcript !== 'string' || transcript.length === 0)) {
    return Promise.resolve(
      createResult({
        state: 'failed',
        errors: [
          {
            code: 'RETRO_TRANSCRIPT_REQUIRED',
            message: 'retro run requires --transcript <path>.',
            retryable: false,
          },
        ],
      }),
    );
  }
  if (typeof transcript === 'string' && !existsSync(nodePath.resolve(invocation.cwd, transcript))) {
    return Promise.resolve(
      createResult({
        state: 'failed',
        errors: [
          {
            code: 'RETRO_TRANSCRIPT_NOT_FOUND',
            message: `Cannot read transcript at ${transcript}.`,
            retryable: false,
          },
        ],
      }),
    );
  }
  return Promise.resolve(
    createResult({
      state: 'action_required',
      findings: [
        {
          code: 'RETRO_CONFIRMATION_REQUIRED',
          message: `\`${name}\` may file tracker findings.`,
          severity: 'warning',
        },
      ],
      nextActions: [{ command: `safeword ${name}`, mutates: true, requiresHuman: true }],
      data: { command: name },
    }),
  );
}

const HANDLERS: Readonly<Record<string, CommandHandler>> = {
  status: statusHandler,
  setup: setupHandler,
  plan: planHandler,
  doctor: statusHandler,
  remove: removeHandler,
  'project sync-config': syncConfigHandler,
  'project architecture': architectureHandler,
  'project sync-learnings': syncLearningsHandler,
  'project sync-tickets': syncTicketsHandler,
  'project codify': codifyHandler,
  'project test-plan': testPlanHandler,
  'project lint-gherkin': lintGherkinHandler,
  'tracker sync': invocation => trackerHandler('tracker sync', invocation),
  'tracker connect': invocation => trackerHandler('tracker connect', invocation),
  'codex migrate': invocation => codexMutationHandler('codex migrate', invocation),
  'codex install': invocation => codexMutationHandler('codex install', invocation),
  'codex status': codexStatusHandler,
  'codex recover': invocation => codexMutationHandler('codex recover', invocation),
  'ticket list': ticketListHandler,
  'ticket new': async invocation => {
    const { createTicketResult } = await import('../commands/ticket-new.js');
    return createTicketResult(String(invocation.operands[0]), invocation.options, invocation.cwd);
  },
  'retro run': invocation => networkRetroHandler('retro run', invocation),
  'retro signals': retroSignalsHandler,
  'retro reconcile': invocation => networkRetroHandler('retro reconcile', invocation),
  check: statusHandler,
  upgrade: setupHandler,
  diff: planHandler,
  reset: removeHandler,
  'sync-config': syncConfigHandler,
  architecture: architectureHandler,
  'sync-learnings': syncLearningsHandler,
  'sync-tickets': syncTicketsHandler,
  codify: codifyHandler,
  'test-plan': testPlanHandler,
  'lint-gherkin': lintGherkinHandler,
  'sync-tracker': invocation => trackerHandler('tracker sync', invocation),
  connect: invocation => trackerHandler('tracker connect', invocation),
  'self-report': retroSignalsHandler,
  retro: invocation => networkRetroHandler('retro run', invocation),
  'retro-reconcile': invocation => networkRetroHandler('retro reconcile', invocation),
  'migrate codex-plugin': invocation => codexMutationHandler('codex migrate', invocation),
  boundary: () =>
    Promise.resolve(
      createResult({ state: 'healthy', data: { command: 'boundary', internal: true } }),
    ),
  'hook codex': () =>
    Promise.resolve(
      createResult({ state: 'healthy', data: { command: 'hook codex', internal: true } }),
    ),
  'codex-hook': () =>
    Promise.resolve(
      createResult({ state: 'healthy', data: { command: 'codex-hook', internal: true } }),
    ),
  'feature-directories': () =>
    Promise.resolve(
      createResult({
        state: 'healthy',
        data: { command: 'feature-directories', internal: true },
      }),
    ),
};

export function publicHandler(name: string): CommandHandler {
  const handler = HANDLERS[name];
  if (handler === undefined) throw new Error(`No typed public handler registered for ${name}`);
  return handler;
}
