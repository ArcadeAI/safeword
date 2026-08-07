import { createHash } from 'node:crypto';
import {
  existsSync,
  linkSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmdirSync,
  unlinkSync,
} from 'node:fs';
import { homedir } from 'node:os';
import nodePath from 'node:path';

import { type CliPlan, createPlan } from '../cli-protocol/plan.js';
import type { Finding, NextAction } from '../cli-protocol/result.js';

const HISTORICAL_SAFEWORD_GLOBAL_GUIDANCE_DIGESTS = new Set([
  // Historical example-claude.md blob 938e0616c1e4d54550adaa27a3b8a86d599c9b5d.
  'f699dc50ce031ac3cbfe924fd00cff3c533c60e59e9de27429d7e585efd8c5d1',
]);

const LEGACY_SIGNATURES = [
  'Feature Development Workflow (CRITICAL - Always Follow)',
  'planning/user-stories/',
  'docs/user-stories/',
  '~/.agents/coding/guides/',
] as const;

type LegacyGlobalGuidanceState = 'absent' | 'unrelated' | 'exact_legacy' | 'suspected_legacy';

export interface LegacyGlobalGuidanceObservation {
  readonly state: LegacyGlobalGuidanceState;
  readonly path?: string;
  readonly digest?: string;
  readonly backupPath?: string;
}

interface ExactLegacyGlobalGuidanceObservation extends LegacyGlobalGuidanceObservation {
  readonly state: 'exact_legacy';
  readonly path: string;
  readonly digest: string;
  readonly backupPath: string;
}

export interface LegacyGlobalGuidanceDiagnostic {
  readonly finding?: Finding;
  readonly nextAction?: NextAction;
  readonly observation: LegacyGlobalGuidanceObservation;
}

interface ObservationOptions {
  readonly registeredDigests?: ReadonlySet<string>;
}

export interface LegacyGlobalGuidanceCleanupResult {
  readonly ok: boolean;
  readonly changed: boolean;
  readonly code?:
    'PLAN_STALE' | 'UNSAFE_GUIDANCE' | 'BACKUP_OCCUPIED' | 'SOURCE_CHANGED_DURING_MOVE';
  readonly sourcePath?: string;
  readonly backupPath?: string;
  readonly recoveryPath?: string;
}

interface CleanupOptions extends ObservationOptions {
  readonly environment?: NodeJS.ProcessEnv;
  readonly planId: string;
  /** Test-only race injection immediately after the final observation. */
  readonly beforeMove?: (sourcePath: string) => void;
  /** Test-only race injection immediately after the source has moved. */
  readonly afterMove?: (sourcePath: string) => void;
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function readNonEmpty(path: string): string | undefined {
  if (!existsSync(path)) return undefined;
  const content = readFileSync(path, 'utf8');
  return content.trim() === '' ? undefined : content;
}

function activeGlobalGuidance(
  environment: NodeJS.ProcessEnv,
): { content: string; path: string } | undefined {
  const codexHome = environment.CODEX_HOME || nodePath.join(homedir(), '.codex');
  const overridePath = nodePath.join(codexHome, 'AGENTS.override.md');
  const overrideContent = readNonEmpty(overridePath);
  if (overrideContent !== undefined) return { content: overrideContent, path: overridePath };

  const agentsPath = nodePath.join(codexHome, 'AGENTS.md');
  const agentsContent = readNonEmpty(agentsPath);
  return agentsContent === undefined ? undefined : { content: agentsContent, path: agentsPath };
}

function resemblesLegacySafewordGuidance(content: string): boolean {
  const signatureMatches = LEGACY_SIGNATURES.filter(signature =>
    content.includes(signature),
  ).length;
  return signatureMatches >= 2 && content.includes('Feature Development Workflow');
}

export function observeLegacyGlobalGuidance(
  environment: NodeJS.ProcessEnv = process.env,
  options: ObservationOptions = {},
): LegacyGlobalGuidanceObservation {
  const active = activeGlobalGuidance(environment);
  if (active === undefined) return { state: 'absent' };

  const digest = sha256(active.content);
  const registeredDigests =
    options.registeredDigests ?? HISTORICAL_SAFEWORD_GLOBAL_GUIDANCE_DIGESTS;
  let state: LegacyGlobalGuidanceState = 'unrelated';
  if (registeredDigests.has(digest)) state = 'exact_legacy';
  else if (resemblesLegacySafewordGuidance(active.content)) state = 'suspected_legacy';
  return {
    state,
    path: active.path,
    digest,
    backupPath: `${active.path}.safeword-legacy.bak`,
  };
}

export function legacyGlobalGuidanceDiagnostic(
  observation: LegacyGlobalGuidanceObservation,
): LegacyGlobalGuidanceDiagnostic {
  if (observation.state === 'exact_legacy') {
    return {
      observation,
      finding: {
        code: 'CODEX_LEGACY_GLOBAL_GUIDANCE_EXACT',
        message: `The active Codex profile guidance at ${observation.path} is an exact historical Safe Word revision that references retired workflow paths.`,
        severity: 'warning',
        metadata: { classification: 'exact_legacy', disposition: 'recoverable_cleanup' },
      },
      nextAction: {
        command: 'safeword codex clean-guidance',
        mutates: false,
        requiresHuman: true,
      },
    };
  }
  if (observation.state === 'suspected_legacy') {
    return {
      observation,
      finding: {
        code: 'CODEX_LEGACY_GLOBAL_GUIDANCE_SUSPECTED',
        message: `The active Codex profile guidance at ${observation.path} resembles edited legacy Safe Word instructions. Review it manually; Safe Word will not modify it.`,
        severity: 'warning',
        metadata: { classification: 'suspected_legacy', disposition: 'manual_review' },
      },
    };
  }
  return { observation };
}

function preconditionDigest(observation: LegacyGlobalGuidanceObservation): string {
  return sha256(`${observation.path ?? ''}\0${observation.digest ?? ''}`);
}

function isExactLegacyObservation(
  observation: LegacyGlobalGuidanceObservation,
): observation is ExactLegacyGlobalGuidanceObservation {
  return (
    observation.state === 'exact_legacy' &&
    observation.path !== undefined &&
    observation.digest !== undefined &&
    observation.backupPath !== undefined
  );
}

export function planLegacyGlobalGuidanceCleanup(observation: LegacyGlobalGuidanceObservation): {
  readonly ok: boolean;
  readonly plan?: CliPlan;
  readonly code?: 'UNSAFE_GUIDANCE';
} {
  if (!isExactLegacyObservation(observation)) {
    return { ok: false, code: 'UNSAFE_GUIDANCE' };
  }
  return {
    ok: true,
    plan: createPlan({
      command: 'codex clean-guidance',
      preconditionDigest: preconditionDigest(observation),
      effects: {
        files: [
          { kind: 'file', target: observation.path, operation: 'move' },
          { kind: 'file', target: observation.backupPath, operation: 'create' },
        ],
        destructive: [
          { kind: 'profile-guidance', target: observation.path, operation: 'deactivate' },
        ],
      },
      requiresConfirmation: true,
      verification: [
        { description: 'The backup digest matches the registered historical revision.' },
      ],
    }),
  };
}

function preserveMovedArtifact(backupPath: string, sourcePath: string): string | undefined {
  try {
    linkSync(backupPath, sourcePath);
    unlinkSync(backupPath);
    return undefined;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }

  for (let index = 0; ; index += 1) {
    const suffix = index === 0 ? '' : `-${index}`;
    const recoveryPath = `${sourcePath}.safeword-recovery${suffix}`;
    try {
      linkSync(backupPath, recoveryPath);
      unlinkSync(backupPath);
      return recoveryPath;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
  }
}

function validatedCleanup(
  environment: NodeJS.ProcessEnv,
  options: CleanupOptions,
):
  | { readonly ok: true; readonly observation: ExactLegacyGlobalGuidanceObservation }
  | { readonly ok: false; readonly result: LegacyGlobalGuidanceCleanupResult } {
  const observation = observeLegacyGlobalGuidance(environment, options);
  if (!isExactLegacyObservation(observation)) {
    return {
      ok: false,
      result: {
        ok: false,
        changed: false,
        code: 'PLAN_STALE',
        sourcePath: observation.path,
      },
    };
  }
  const preview = planLegacyGlobalGuidanceCleanup(observation);
  if (!preview.ok || preview.plan === undefined) {
    return {
      ok: false,
      result: {
        ok: false,
        changed: false,
        code: 'UNSAFE_GUIDANCE',
        sourcePath: observation.path,
      },
    };
  }
  if (preview.plan.id !== options.planId) {
    return {
      ok: false,
      result: { ok: false, changed: false, code: 'PLAN_STALE', sourcePath: observation.path },
    };
  }
  return { ok: true, observation };
}

function refusedAfterMove(
  stagedPath: string,
  stagingDirectory: string,
  sourcePath: string,
  backupPath: string,
  code: 'BACKUP_OCCUPIED' | 'SOURCE_CHANGED_DURING_MOVE',
): LegacyGlobalGuidanceCleanupResult {
  const recoveryPath = preserveMovedArtifact(stagedPath, sourcePath);
  rmdirSync(stagingDirectory);
  return {
    ok: false,
    changed: false,
    code,
    sourcePath,
    backupPath,
    ...(recoveryPath !== undefined && { recoveryPath }),
  };
}

export function applyLegacyGlobalGuidanceCleanup(
  options: CleanupOptions,
): LegacyGlobalGuidanceCleanupResult {
  const environment = options.environment ?? process.env;
  const validation = validatedCleanup(environment, options);
  if (!validation.ok) return validation.result;

  const { observation } = validation;
  const sourcePath = observation.path;
  const backupPath = observation.backupPath;
  const stagingDirectory = mkdtempSync(
    nodePath.join(nodePath.dirname(sourcePath), '.safeword-guidance-'),
  );
  const stagedPath = nodePath.join(stagingDirectory, nodePath.basename(sourcePath));

  options.beforeMove?.(sourcePath);
  try {
    renameSync(sourcePath, stagedPath);
  } catch (error) {
    rmdirSync(stagingDirectory);
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { ok: false, changed: false, code: 'PLAN_STALE', sourcePath, backupPath };
    }
    throw error;
  }
  options.afterMove?.(sourcePath);

  const movedDigest = sha256(readFileSync(stagedPath, 'utf8'));
  if (movedDigest !== observation.digest) {
    return refusedAfterMove(
      stagedPath,
      stagingDirectory,
      sourcePath,
      backupPath,
      'SOURCE_CHANGED_DURING_MOVE',
    );
  }

  try {
    linkSync(stagedPath, backupPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      return refusedAfterMove(
        stagedPath,
        stagingDirectory,
        sourcePath,
        backupPath,
        'BACKUP_OCCUPIED',
      );
    }
    preserveMovedArtifact(stagedPath, sourcePath);
    rmdirSync(stagingDirectory);
    throw error;
  }
  unlinkSync(stagedPath);
  rmdirSync(stagingDirectory);

  return { ok: true, changed: true, sourcePath, backupPath };
}
