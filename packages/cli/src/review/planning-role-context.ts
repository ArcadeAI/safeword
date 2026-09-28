import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { PLANNING_DATA_GUIDE_PATH } from '../schema.js';
import { listArchitectureRecords } from '../utils/architecture-records.js';
import { resolveConfiguredPath } from '../utils/configured-paths.js';
import { collectExecutableFeatureFiles, featureSourceFileName } from '../utils/feature-source.js';
import { parseTicketMetadata } from '../utils/ticket-metadata.js';
import type { ReviewKind, ReviewPacket } from './contract.js';
import {
  PLANNING_CONTEXT_ROLES,
  PlanningContextError,
  type PlanningContextRole,
} from './planning-context-error.js';
import {
  planningEvidenceReferences,
  planningSkipReason,
  validatePlanningProductFrame,
} from './planning-context-identity.js';
import { planningTicketOwner } from './planning-ticket-owner.js';

export interface PlanningContextDependency {
  readonly role: PlanningContextRole;
  readonly path: string;
}
export interface JustifiedAbsence {
  readonly role: PlanningContextRole;
  readonly reason: string;
  readonly authority: string;
}
export interface PlanningRoleContext {
  readonly schema_version: 1;
  readonly ticket_id: string;
  readonly ticket_path: string;
  readonly dependencies: readonly PlanningContextDependency[];
  readonly absences: readonly JustifiedAbsence[];
}
export interface PlanningReviewIdentity extends PlanningRoleContext {
  readonly review_kind:
    'quality-review' | 'scenario-gate' | 'plan-implementation' | 'plan-execution';
  readonly targets: readonly { readonly path: string; readonly digest: string }[];
  readonly canonical_contract_digest: string;
  readonly dependencies: readonly (PlanningContextDependency & {
    readonly semantic_digest: string;
  })[];
}

type CapturedFile = ReviewPacket['logical_files'][number];

function captured(
  files: readonly CapturedFile[],
  role: PlanningContextRole,
  path: string,
): CapturedFile {
  const file = files.find(value => value.path === path);
  if (file === undefined || file.content.trim() === '') throw new PlanningContextError(role, path);
  return file;
}

function sectionSkip(plan: CapturedFile, role: 'architecture' | 'data'): string | undefined {
  try {
    return planningSkipReason(
      plan.content,
      `${role === 'data' ? 'Data' : 'Architecture'} applicability`,
    );
  } catch {
    throw new PlanningContextError(
      role,
      `${plan.path}#${role}-applicability`,
      `${role === 'data' ? 'Data' : 'Architecture'} applicability`,
    );
  }
}

function scenarioSource(cwd: string, ticket: Record<string, unknown>, directory: string): string {
  const anchors = ticket.phase_anchors;
  if (anchors === undefined) {
    const name = featureSourceFileName(cwd, nodePath.basename(directory));
    const matches = collectExecutableFeatureFiles(cwd, name);
    if (matches.length !== 1 || matches[0] === undefined)
      throw new PlanningContextError('scenarios', `features/${name}`);
    return nodePath.relative(cwd, matches[0]);
  }
  if (!Array.isArray(anchors))
    throw new PlanningContextError('scenarios', `${directory}/ticket.md:phase_anchors`);
  const matches = anchors.flatMap((value: unknown) => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return [];
    const entry = value as Record<string, unknown>;
    return typeof entry['scenario-gate'] === 'string' ? [entry['scenario-gate']] : [];
  });
  const source = matches.at(-1);
  if (source === undefined || source.trim() === '' || nodePath.extname(source) !== '.feature')
    throw new PlanningContextError('scenarios', `${directory}/ticket.md:phase_anchors`);
  const normalized = nodePath.relative(cwd, nodePath.resolve(cwd, source));
  if (normalized.startsWith(`..${nodePath.sep}`) || normalized === '..')
    throw new PlanningContextError('scenarios', `${directory}/ticket.md:phase_anchors`);
  return normalized;
}

function optionalDimensions(cwd: string, directory: string, authority: string) {
  const path = nodePath.join(directory, 'dimensions.md');
  return existsSync(nodePath.resolve(cwd, path))
    ? { dependency: { role: 'dimensions' as const, path } }
    : {
        absence: {
          role: 'dimensions' as const,
          reason: 'The ticket has no dimensions artifact.',
          authority,
        },
      };
}

function architectureOverride(cwd: string): { declared: boolean; value: unknown } {
  const configPath = nodePath.join(cwd, '.safeword/config.json');
  if (!existsSync(configPath)) return { declared: false, value: undefined };
  try {
    const config: unknown = JSON.parse(readFileSync(configPath, 'utf8'));
    if (!plainRecord(config)) throw new TypeError('Configuration must be an object.');
    const paths = config.paths;
    if (paths === undefined) return { declared: false, value: undefined };
    if (!plainRecord(paths)) throw new TypeError('Configured paths must be an object.');
    return { declared: Object.hasOwn(paths, 'architecture'), value: paths.architecture };
  } catch {
    throw new PlanningContextError('architecture', '.safeword/config.json');
  }
}
function plainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function configuredArchitectureLocation(cwd: string): string {
  const path = resolveConfiguredPath(cwd, 'architecture');
  const configured = architectureOverride(cwd);
  const value = configured.value;
  if (
    configured.declared &&
    (typeof value !== 'string' || value.trim() === '' || !existsSync(path))
  )
    throw new PlanningContextError('architecture', nodePath.relative(cwd, path));
  return path;
}

function architectureSources(
  cwd: string,
  plan: CapturedFile,
): {
  dependencies: PlanningContextDependency[];
  absences: JustifiedAbsence[];
} {
  const path = configuredArchitectureLocation(cwd);
  const records = listArchitectureRecords(path);
  if (records.records.length > 0)
    return {
      dependencies: records.records
        .toSorted((a, b) => a.localeCompare(b))
        .map(source => ({ role: 'architecture', path: nodePath.relative(cwd, source) })),
      absences: [],
    };
  const reason = sectionSkip(plan, 'architecture');
  if (reason === undefined)
    throw new PlanningContextError('architecture', nodePath.relative(cwd, path));
  return { dependencies: [], absences: [{ role: 'architecture', reason, authority: plan.path }] };
}

function inheritedSources(
  ticket: Record<string, unknown>,
  ticketFile: CapturedFile,
  files: readonly CapturedFile[],
): {
  dependencies: PlanningContextDependency[];
  absences: JustifiedAbsence[];
  project: string;
} {
  const spec = nodePath.join(nodePath.dirname(ticketFile.path), 'spec.md');
  if (!Object.hasOwn(ticket, 'parent'))
    return {
      dependencies: [],
      project: spec,
      absences: ['parent', 'milestone'].map(role => ({
        role: role as 'parent' | 'milestone',
        reason: 'The ticket declares no parent relationship.',
        authority: ticketFile.path,
      })),
    };
  const parent = files.find(
    file =>
      nodePath.basename(file.path) === 'ticket.md' &&
      file.path !== ticketFile.path &&
      parseTicketMetadata(file.content).metadata.id === ticket.parent,
  );
  if (parent === undefined) throw new PlanningContextError('parent', `${ticketFile.path}:parent`);
  if (
    typeof ticket.parent_job !== 'string' ||
    ticket.parent_job.trim() === '' ||
    typeof ticket.milestone !== 'string' ||
    ticket.milestone.trim() === ''
  )
    throw new PlanningContextError('milestone', `${ticketFile.path}:milestone`);
  const project = nodePath.join(nodePath.dirname(parent.path), 'spec.md');
  return {
    project,
    dependencies: [
      { role: 'parent', path: parent.path },
      { role: 'parent', path: project },
      { role: 'milestone', path: project },
    ],
    absences: [],
  };
}

function requireOwnedPlanningTicket(
  ticket: Record<string, unknown>,
  ticketPath: string,
): asserts ticket is Record<string, unknown> & { id: string } {
  if (!planningTicketOwner(ticket, nodePath.basename(nodePath.dirname(ticketPath)), ticketPath))
    throw new PlanningContextError('ticket', ticketPath);
}

/** Canonical owned planning routes derive their roles; callers cannot assert completeness. */
export function resolvePlanningRoleContext(
  cwd: string,
  kind: ReviewKind,
  planningPhase: ReviewPacket['planning_phase'],
  targets: readonly CapturedFile[],
  files: readonly CapturedFile[],
): PlanningRoleContext | undefined {
  if (kind === 'scenario-gate') return resolveScenarioRoleContext(cwd, targets, files);
  if (planningPhase === 'product-plan') return resolveProductRoleContext(cwd, targets, files);
  if (planningPhase === 'plan-execution') return resolveExecutionRoleContext(cwd, targets, files);
  if (planningPhase !== 'plan-implementation') return undefined;
  const plan = targets[0];
  if (plan === undefined) throw new PlanningContextError('ticket', 'impl-plan.md');
  const directory = nodePath.dirname(plan.path);
  const ticketPath = nodePath.join(directory, 'ticket.md');
  const ticketFile = captured(files, 'ticket', ticketPath);
  const ticket = parseTicketMetadata(ticketFile.content).metadata;
  requireOwnedPlanningTicket(ticket, ticketPath);
  const inherited = inheritedSources(ticket, ticketFile, files);
  const project = captured(files, 'project', inherited.project);
  try {
    validatePlanningProductFrame(project.content);
  } catch {
    throw new PlanningContextError('project', project.path);
  }
  const dependencies: PlanningContextDependency[] = [
    { role: 'ticket', path: ticketPath },
    { role: 'project', path: project.path },
    ...inherited.dependencies,
    { role: 'rules', path: nodePath.join(directory, 'spec.md') },
    { role: 'scenarios', path: scenarioSource(cwd, ticket, directory) },
    ...(['principles', 'personas', 'surfaces'] as const).map(role => ({
      role,
      path: nodePath.relative(cwd, resolveConfiguredPath(cwd, role)),
    })),
  ];
  const absences: JustifiedAbsence[] = [...inherited.absences];
  const dimensions = optionalDimensions(cwd, directory, ticketPath);
  if (dimensions.dependency === undefined) {
    absences.push(dimensions.absence);
  } else {
    dependencies.push(dimensions.dependency);
  }
  const architecture = architectureSources(cwd, plan);
  dependencies.push(...architecture.dependencies);
  absences.push(...architecture.absences);
  const dataSkip = sectionSkip(plan, 'data');
  if (dataSkip === undefined) dependencies.push({ role: 'data', path: PLANNING_DATA_GUIDE_PATH });
  else absences.push({ role: 'data', reason: dataSkip, authority: plan.path });
  if (planningEvidenceReferences(plan.content).length > 0)
    dependencies.push({ role: 'reusable-evidence', path: plan.path });
  else
    absences.push({
      role: 'reusable-evidence',
      reason: 'The reviewed plan names no reusable evidence sources.',
      authority: plan.path,
    });
  absences.push({
    role: 'accepted-upstream-plan',
    reason: 'Implementation review precedes an accepted Implementation Plan.',
    authority: plan.path,
  });
  return {
    schema_version: 1,
    ticket_id: ticket.id,
    ticket_path: ticketPath,
    dependencies,
    absences,
  };
}

function resolveExecutionRoleContext(
  cwd: string,
  targets: readonly CapturedFile[],
  files: readonly CapturedFile[],
): PlanningRoleContext {
  const plan = targets[0];
  if (plan === undefined) throw new PlanningContextError('ticket', 'execution-plan.md');
  const directory = nodePath.dirname(plan.path);
  const ticketPath = nodePath.join(directory, 'ticket.md');
  const ticketFile = captured(files, 'ticket', ticketPath);
  const ticket = parseTicketMetadata(ticketFile.content).metadata;
  requireOwnedPlanningTicket(ticket, ticketPath);
  const inherited = inheritedSources(ticket, ticketFile, files);
  const project = captured(files, 'project', inherited.project);
  try {
    validatePlanningProductFrame(project.content);
  } catch {
    throw new PlanningContextError('project', project.path);
  }
  const upstreamPath = nodePath.join(directory, 'impl-plan.md');
  const upstream = captured(files, 'accepted-upstream-plan', upstreamPath);
  const dependencies: PlanningContextDependency[] = [
    { role: 'ticket', path: ticketPath },
    { role: 'project', path: project.path },
    ...inherited.dependencies,
    { role: 'rules', path: nodePath.join(directory, 'spec.md') },
    { role: 'scenarios', path: scenarioSource(cwd, ticket, directory) },
    ...(['principles', 'personas', 'surfaces'] as const).map(role => ({
      role,
      path: nodePath.relative(cwd, resolveConfiguredPath(cwd, role)),
    })),
    { role: 'accepted-upstream-plan', path: upstream.path },
  ];
  const absences: JustifiedAbsence[] = [...inherited.absences];
  const dimensions = optionalDimensions(cwd, directory, ticketPath);
  if (dimensions.dependency === undefined) absences.push(dimensions.absence);
  else dependencies.push(dimensions.dependency);
  const architecture = architectureSources(cwd, upstream);
  dependencies.push(...architecture.dependencies);
  absences.push(...architecture.absences);
  const dataSkip = sectionSkip(upstream, 'data');
  if (dataSkip === undefined) dependencies.push({ role: 'data', path: PLANNING_DATA_GUIDE_PATH });
  else absences.push({ role: 'data', reason: dataSkip, authority: upstream.path });
  if (planningEvidenceReferences(upstream.content).length > 0)
    dependencies.push({ role: 'reusable-evidence', path: upstream.path });
  else
    absences.push({
      role: 'reusable-evidence',
      reason: 'The accepted Implementation Plan names no reusable evidence sources.',
      authority: upstream.path,
    });
  return {
    schema_version: 1,
    ticket_id: ticket.id,
    ticket_path: ticketPath,
    dependencies,
    absences,
  };
}

function resolveScenarioRoleContext(
  cwd: string,
  targets: readonly CapturedFile[],
  files: readonly CapturedFile[],
): PlanningRoleContext | undefined {
  const scenario = targets[0];
  const spec = files[0];
  if (scenario === undefined || spec === undefined) return undefined;
  const ticketPath = nodePath.join(nodePath.dirname(spec.path), 'ticket.md');
  const ticketFile = files.find(file => file.path === ticketPath);
  if (ticketFile === undefined) return undefined;
  const ticket = parseTicketMetadata(ticketFile.content).metadata;
  if (ticket.product_plan_contract !== 'v1') return undefined;
  requireOwnedPlanningTicket(ticket, ticketPath);
  if (scenarioSource(cwd, ticket, nodePath.dirname(spec.path)) !== scenario.path)
    throw new PlanningContextError('scenarios', scenario.path);
  const inherited = inheritedSources(ticket, ticketFile, files);
  const project = captured(files, 'project', inherited.project);
  try {
    validatePlanningProductFrame(project.content);
  } catch {
    throw new PlanningContextError('project', project.path);
  }
  return {
    schema_version: 1,
    ticket_id: ticket.id,
    ticket_path: ticketPath,
    dependencies: [
      { role: 'ticket', path: ticketPath },
      { role: 'project', path: project.path },
      ...inherited.dependencies,
      { role: 'rules', path: spec.path },
      { role: 'scenarios', path: scenario.path },
      ...(['principles', 'personas', 'surfaces'] as const).map(role => ({
        role,
        path: nodePath.relative(cwd, resolveConfiguredPath(cwd, role)),
      })),
    ],
    absences: [
      ...inherited.absences,
      ...(
        [
          'dimensions',
          'architecture',
          'data',
          'reusable-evidence',
          'accepted-upstream-plan',
        ] as const
      ).map(role => ({
        role,
        reason: `${role} is not an entry requirement for Scenario review.`,
        authority: scenario.path,
      })),
    ],
  };
}

function resolveProductRoleContext(
  cwd: string,
  targets: readonly CapturedFile[],
  files: readonly CapturedFile[],
): PlanningRoleContext {
  const plan = targets[0];
  if (plan === undefined) throw new PlanningContextError('project', 'spec.md');
  const ticketPath = nodePath.join(nodePath.dirname(plan.path), 'ticket.md');
  const ticketFile = captured(files, 'ticket', ticketPath);
  const ticket = parseTicketMetadata(ticketFile.content).metadata;
  requireOwnedPlanningTicket(ticket, ticketPath);
  const inherited = inheritedSources(ticket, ticketFile, files);
  const project =
    inherited.project === plan.path ? plan : captured(files, 'project', inherited.project);
  try {
    validatePlanningProductFrame(project.content);
  } catch {
    throw new PlanningContextError('project', project.path);
  }
  return {
    schema_version: 1,
    ticket_id: ticket.id,
    ticket_path: ticketPath,
    dependencies: [
      { role: 'ticket', path: ticketPath },
      { role: 'project', path: project.path },
      ...inherited.dependencies,
      { role: 'rules', path: plan.path },
      ...(['principles', 'personas', 'surfaces'] as const).map(role => ({
        role,
        path: nodePath.relative(cwd, resolveConfiguredPath(cwd, role)),
      })),
    ],
    absences: [
      ...inherited.absences,
      ...(
        [
          'scenarios',
          'dimensions',
          'architecture',
          'data',
          'reusable-evidence',
          'accepted-upstream-plan',
        ] as const
      ).map(role => ({
        role,
        reason: `${role} is not an entry requirement for Product review.`,
        authority: plan.path,
      })),
    ],
  };
}

function recordWithKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every(key => Object.hasOwn(value, key))
  );
}
function nonblank(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}
function digest(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
}
const roleSet: ReadonlySet<unknown> = new Set(PLANNING_CONTEXT_ROLES);
function knownRole(value: unknown): value is PlanningContextRole {
  return roleSet.has(value);
}
function dependency(value: unknown): value is PlanningReviewIdentity['dependencies'][number] {
  return (
    recordWithKeys(value, ['role', 'path', 'semantic_digest']) &&
    knownRole(value.role) &&
    nonblank(value.path) &&
    digest(value.semantic_digest)
  );
}
function absence(value: unknown): value is JustifiedAbsence {
  return (
    recordWithKeys(value, ['role', 'reason', 'authority']) &&
    knownRole(value.role) &&
    nonblank(value.reason) &&
    nonblank(value.authority)
  );
}
function exactTarget(value: unknown): value is PlanningReviewIdentity['targets'][number] {
  return recordWithKeys(value, ['path', 'digest']) && nonblank(value.path) && digest(value.digest);
}
const productInapplicableRoles: readonly PlanningContextRole[] = [
  'scenarios',
  'dimensions',
  'architecture',
  'data',
  'reusable-evidence',
  'accepted-upstream-plan',
];
const requiredPlanningRoles: readonly PlanningContextRole[] = [
  'ticket',
  'project',
  'rules',
  'principles',
  'personas',
  'surfaces',
];
function completeRoles(identity: PlanningReviewIdentity): boolean {
  const present = new Set(identity.dependencies.map(value => value.role));
  const absent = new Set(identity.absences.map(value => value.role));
  const paths = new Set(identity.dependencies.map(value => `${value.role}\0${value.path}`));
  return (
    requiredPlanningRoles.every(role => present.has(role)) &&
    phaseRolesComplete(identity.review_kind, present, absent) &&
    paths.size === identity.dependencies.length &&
    absent.size === identity.absences.length &&
    present.intersection(absent).size === 0 &&
    present.union(absent).size === PLANNING_CONTEXT_ROLES.length
  );
}
function phaseRolesComplete(
  kind: PlanningReviewIdentity['review_kind'],
  present: ReadonlySet<PlanningContextRole>,
  absent: ReadonlySet<PlanningContextRole>,
): boolean {
  if (kind === 'quality-review') return productInapplicableRoles.every(role => absent.has(role));
  if (!present.has('scenarios')) return false;
  if (kind === 'scenario-gate')
    return productInapplicableRoles
      .filter(role => role !== 'scenarios')
      .every(role => absent.has(role));
  if (kind === 'plan-execution') return present.has('accepted-upstream-plan');
  return true;
}
const planningReviewKinds = new Set<unknown>([
  'quality-review',
  'scenario-gate',
  'plan-implementation',
  'plan-execution',
]);
function identityHeader(value: Record<string, unknown>): boolean {
  return (
    value.schema_version === 1 &&
    planningReviewKinds.has(value.review_kind) &&
    nonblank(value.ticket_id) &&
    nonblank(value.ticket_path) &&
    digest(value.canonical_contract_digest)
  );
}
function identityRows(value: Record<string, unknown>): boolean {
  return (
    Array.isArray(value.dependencies) &&
    value.dependencies.every(dependency) &&
    Array.isArray(value.absences) &&
    value.absences.every(absence) &&
    Array.isArray(value.targets) &&
    value.targets.length === 1 &&
    value.targets.every(exactTarget)
  );
}
/** Unknown versions and incomplete role records cannot become approval authority. */
export function isPlanningReviewIdentity(value: unknown): value is PlanningReviewIdentity {
  if (
    !recordWithKeys(value, [
      'schema_version',
      'ticket_id',
      'ticket_path',
      'dependencies',
      'absences',
      'review_kind',
      'targets',
      'canonical_contract_digest',
    ])
  )
    return false;
  return (
    identityHeader(value) &&
    identityRows(value) &&
    completeRoles(value as unknown as PlanningReviewIdentity)
  );
}
