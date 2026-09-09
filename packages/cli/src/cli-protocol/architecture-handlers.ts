/**
 * Handler and result builders for `project architecture`: drift checking,
 * self-heal, and the staged-tree modes driven by --from-index/--stage-output.
 *
 * A sibling module, matching the other domain handler modules: the routing
 * table stays in public-handlers.ts, and the document engine stays behind
 * dynamic imports.
 */

import nodePath from 'node:path';

import { isWouldChangeAction, type SelfHealAction } from '../utils/architecture-document.js';
import type { CommandInvocation } from './handler.js';
import { type CliResult, createResult } from './result.js';

type ArchitectureAdvisory = {
  readonly code: string;
  readonly message: string;
  readonly severity: 'info';
};

type HealedDocument = { readonly action: SelfHealAction; readonly path: string };

function architectureAdvisories(
  unreadableWorkspaces: readonly {
    config: string;
    manager: string;
  }[],
): ArchitectureAdvisory[] {
  return unreadableWorkspaces.map(workspace => ({
    code: 'ARCHITECTURE_ADVISORY',
    message: `Workspace config present but unreadable: ${workspace.config} (${workspace.manager}).`,
    severity: 'info' as const,
  }));
}

function architectureEnforcementDisabledResult(
  advisories: readonly ArchitectureAdvisory[],
): CliResult {
  return createResult({
    state: 'healthy',
    findings: [
      {
        code: 'ARCHITECTURE_ENFORCEMENT_DISABLED',
        message: 'Architecture doc enforcement is opted out (architectureDocEnforcement: false).',
        severity: 'info',
      },
      ...advisories,
    ],
    data: { command: 'project architecture', enforcement: false },
  });
}

function architectureCheckResult(
  stale: readonly string[],
  advisories: readonly ArchitectureAdvisory[],
): CliResult {
  return createResult({
    state: stale.length === 0 ? 'healthy' : 'action_required',
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
    findings:
      stale.length === 0
        ? advisories
        : [
            {
              code: 'ARCHITECTURE_DRIFT',
              message: `Architecture documents are stale (${stale.join(', ')}). Run \`safeword project architecture\` for the current worktree, or \`safeword project architecture --from-index\` to reproduce the staged tree, then commit the result.`,
              severity: 'warning',
            },
            ...advisories,
          ],
    data: { command: 'project architecture', planned: stale, enforcement: true },
  });
}

type ArchitectureModeMessage = {
  readonly code: string;
  readonly message: string;
  readonly severity: 'info' | 'warning';
};

function architectureModeResult(input: {
  readonly cwd: string;
  readonly mode: 'stage' | 'staged';
  readonly results: readonly HealedDocument[];
  readonly stagedPaths: readonly string[];
  readonly stageFailures: readonly string[];
  readonly failed: boolean;
  readonly autoStageAvailable: boolean;
  readonly messages: readonly ArchitectureModeMessage[];
  readonly errors: readonly string[];
}): CliResult {
  const changed = input.results.filter(result => isWouldChangeAction(result.action));
  const mutated = changed.length > 0 || input.stagedPaths.length > 0;
  let state: CliResult['state'] = 'healthy';
  if (input.failed) state = 'failed';
  else if (mutated) state = 'changed';

  return createResult({
    state,
    changed: mutated,
    effects: {
      files: [
        ...changed.map(result => ({
          kind: result.action === 'created' ? 'create' : 'update',
          target: nodePath.relative(input.cwd, result.path),
        })),
        ...input.stagedPaths.map(target => ({ kind: 'stage', target, operation: 'stage' })),
      ],
    },
    findings: input.messages,
    errors: input.errors.map(message => ({
      code: 'ARCHITECTURE_STAGED_TREE_FAILED',
      message,
      retryable: true,
    })),
    data: {
      command: 'project architecture',
      mode: input.mode,
      staged:
        input.mode === 'stage' && input.autoStageAvailable && input.stageFailures.length === 0,
      staged_files: input.stagedPaths,
      stage_failures: input.stageFailures,
      enforcement: true,
    },
  });
}

async function runArchitectureStagedTreeMode(
  invocation: CommandInvocation,
  mode: 'stage' | 'staged',
): Promise<CliResult> {
  const messages: ArchitectureModeMessage[] = [];
  const errors: string[] = [];
  const reporter = {
    success(message: string): void {
      messages.push({ code: 'ARCHITECTURE_MESSAGE', message, severity: 'info' });
    },
    warn(message: string): void {
      messages.push({ code: 'ARCHITECTURE_WARNING', message, severity: 'warning' });
    },
    error(message: string): void {
      errors.push(message);
    },
  };
  const { architectureStage, architectureStaged } = await import('../commands/architecture.js');
  const outcome =
    mode === 'stage'
      ? await architectureStage(invocation.cwd, reporter)
      : await architectureStaged(invocation.cwd, reporter);

  return architectureModeResult({
    cwd: invocation.cwd,
    mode,
    ...outcome,
    messages,
    errors,
  });
}

interface ArchitectureCliMode {
  readonly fromIndex: boolean;
  readonly stageOutput: boolean;
  readonly legacy?: '--stage' | '--staged';
}

function architectureCliMode(options: Readonly<Record<string, unknown>>): ArchitectureCliMode {
  let legacy: ArchitectureCliMode['legacy'];
  if (options.stage === true) legacy = '--stage';
  else if (options.staged === true) legacy = '--staged';
  return {
    fromIndex: options.fromIndex === true || legacy !== undefined,
    stageOutput: options.stageOutput === true || legacy === '--stage',
    ...(legacy !== undefined && { legacy }),
  };
}

function architectureOptionsConflict(options: Readonly<Record<string, unknown>>): boolean {
  const legacyCount = Number(options.stage === true) + Number(options.staged === true);
  const canonicalSelected = options.fromIndex === true || options.stageOutput === true;
  return legacyCount > 1 || (legacyCount > 0 && canonicalSelected);
}

/**
 * `--check` is read-only by contract (predictable-safeword-cli.TBU1.R2), so it
 * cannot be combined with a flag whose entire purpose is writing to the Git
 * index. `--check --from-index` is legal: it is answered read-only.
 */
function architectureCheckWriteConflict(options: Readonly<Record<string, unknown>>): boolean {
  const stageOutputRequested = options.stageOutput === true || options.stage === true;
  return options.check === true && stageOutputRequested;
}

async function runArchitectureIndexCheck(invocation: CommandInvocation): Promise<CliResult> {
  const { architectureIndexCheck } = await import('../commands/architecture.js');
  const outcome = architectureIndexCheck(invocation.cwd);
  const advisories = architectureAdvisories(outcome.unreadableWorkspaces);

  if (outcome.failureMessage !== undefined) {
    return createResult({
      state: 'failed',
      findings: advisories,
      errors: [
        {
          code: 'ARCHITECTURE_INDEX_CHECK_FAILED',
          message: `Could not check architecture freshness from the Git index; nothing was written or staged. Cause: ${outcome.failureMessage}`,
          retryable: true,
        },
      ],
      data: { command: 'project architecture', enforcement: true },
    });
  }

  return architectureCheckResult(outcome.stale, advisories);
}

function withArchitectureOptionCompatibility(
  result: CliResult,
  legacy: ArchitectureCliMode['legacy'],
): CliResult {
  if (legacy === undefined) return result;
  const replacement = legacy === '--stage' ? '--from-index --stage-output' : '--from-index';
  return {
    ...result,
    findings: [
      ...result.findings,
      {
        code: 'CLI_OPTION_DEPRECATED',
        message: `${legacy} is deprecated; use ${replacement}.`,
        severity: 'warning',
        metadata: { legacy, replacement, retention: 'indefinite' },
      },
    ],
  };
}

export async function architectureHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { planSelfHealProject, selfHealProject } =
    await import('../utils/architecture-document.js');
  const { discoverUnreadableWorkspaces, extractMonorepoArchitectureSnapshot } =
    await import('../utils/architecture-monorepo.js');
  const { isArchitectureDocumentEnforcementEnabled } = await import('../utils/configured-paths.js');

  const enforcementEnabled = isArchitectureDocumentEnforcementEnabled(invocation.cwd);
  if (architectureOptionsConflict(invocation.options)) {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'CLI_ARGUMENT_INVALID',
          message:
            'Choose either one legacy architecture option or the canonical --from-index/--stage-output options.',
          retryable: false,
        },
      ],
      data: { command: 'project architecture' },
    });
  }
  if (architectureCheckWriteConflict(invocation.options)) {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'CLI_ARGUMENT_INVALID',
          message:
            '--check cannot be combined with --stage-output; --check never writes documents or stages them.',
          retryable: false,
        },
      ],
      data: { command: 'project architecture' },
    });
  }
  const mode = architectureCliMode(invocation.options);
  if (mode.stageOutput && !mode.fromIndex) {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'ARCHITECTURE_INPUT_REQUIRED',
          message:
            '--stage-output requires --from-index so staged output has a reproducible source.',
          retryable: false,
        },
      ],
      data: { command: 'project architecture' },
    });
  }
  if (!enforcementEnabled) {
    return architectureEnforcementDisabledResult(
      architectureAdvisories(discoverUnreadableWorkspaces(invocation.cwd)),
    );
  }

  if (mode.fromIndex) {
    // `--check` wins over the generation modes: it must stay read-only even when
    // the caller also names the deterministic index source.
    const generationMode = mode.stageOutput ? 'stage' : 'staged';
    const result = await (invocation.options.check === true
      ? runArchitectureIndexCheck(invocation)
      : runArchitectureStagedTreeMode(invocation, generationMode));
    return withArchitectureOptionCompatibility(result, mode.legacy);
  }

  const snapshot = extractMonorepoArchitectureSnapshot(invocation.cwd);
  const advisories = architectureAdvisories(snapshot.model.unreadableWorkspaces);
  if (invocation.options.check === true) {
    const stale = planSelfHealProject(invocation.cwd, snapshot).filter(action =>
      isWouldChangeAction(action),
    );
    return architectureCheckResult(stale, advisories);
  }

  const results = selfHealProject(invocation.cwd, snapshot);
  const changed = results.filter(result => isWouldChangeAction(result.action));

  return architectureHealResult({
    cwd: invocation.cwd,
    changed,
    advisories,
  });
}

function healedDocumentFindings(
  cwd: string,
  changed: readonly HealedDocument[],
): CliResult['findings'] {
  if (changed.length === 0) {
    return [
      {
        code: 'ARCHITECTURE_UNCHANGED',
        message: 'Architecture documents are unchanged.',
        severity: 'info',
      },
    ];
  }
  const healed = changed.map(result => nodePath.relative(cwd, result.path)).join(', ');
  return [
    {
      code: 'ARCHITECTURE_REFRESHED',
      message: `Architecture documents created, healed, or regenerated (${healed}).`,
      severity: 'info',
    },
  ];
}

function architectureHealResult(input: {
  readonly cwd: string;
  readonly changed: readonly HealedDocument[];
  readonly advisories: readonly ArchitectureAdvisory[];
}): CliResult {
  const changedDocuments = input.changed.length > 0;

  return createResult({
    state: changedDocuments ? 'changed' : 'healthy',
    changed: changedDocuments,
    effects: {
      files: input.changed.map(result => ({
        kind: result.action === 'created' ? 'create' : 'update',
        target: nodePath.relative(input.cwd, result.path),
      })),
    },
    findings: [...healedDocumentFindings(input.cwd, input.changed), ...input.advisories],
    data: {
      command: 'project architecture',
      enforcement: true,
    },
  });
}
