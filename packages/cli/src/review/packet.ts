import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import {
  createExecutionPlanDeliveryDefinition,
  hasCanonicalDeliveryContractIdentity,
  normalizedExecutionPlanDigest,
  parseDeliveryPlanContract,
} from '../execution-plan/delivery-checklist.js';
import { PLANNING_AUTHOR_COPIES } from '../planning/contracts.generated.js';
import type { PlanningAuthorCopyIdentity, PlanningPhase } from '../planning/phase-contract.js';
import { cursorPlanningContractPath } from '../schema.js';
import { resolveConfiguredPath, resolveTicketsDirectory } from '../utils/configured-paths.js';
import { parseTicketMetadata } from '../utils/ticket-metadata.js';
import type {
  ExecutionPlanDeliveryDefinition,
  PlanContractPair,
  RedExecutionAttestation,
  ReviewKind,
  ReviewPacket,
} from './contract.js';
import { ReviewPacketError } from './packet-error.js';
import { reviewDispositionContext } from './planning-accepted-boundary.js';
import { PlanningContextError, type PlanningContextRole } from './planning-context-error.js';
import { planningEvidenceRecords } from './planning-context-identity.js';
import { type PlanningRoleContext, resolvePlanningRoleContext } from './planning-role-context.js';
import { planningTicketOwner } from './planning-ticket-owner.js';
export { ReviewPacketError } from './packet-error.js';
export { PlanningContextError } from './planning-context-error.js';
import { EXECUTION_PLAN_REVIEW_RUBRIC } from './execution-plan-rubric.generated.js';
import { extractExecutionPlanReviewRubric } from './execution-plan-rubric.js';
import { PLAN_REVIEW_RUBRIC } from './plan-rubric.generated.js';
import { extractPlanReviewRubric } from './plan-rubric.js';
import { PRODUCT_PLAN_REVIEW_RUBRIC } from './product-plan-rubric.generated.js';
import { extractProductPlanReviewRubric } from './product-plan-rubric.js';

const MAX_FILE_COUNT = 64;
const MAX_FILE_BYTES = 256 * 1024;
const MAX_PACKET_BYTES = 1024 * 1024;
const HIGH_CONFIDENCE_SECRET_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/u,
  /\bAKIA[0-9A-Z]{16}\b/u,
  /\bgh[pousr]_[A-Za-z0-9]{36,}\b/u,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/u,
  /\bsk-(?:proj-|ant-)[\w-]{16,}\b/u,
  /\bAIza[\w-]{35}\b/u,
] as const;

export interface PreparedReviewPacket {
  readonly packet: ReviewPacket;
  readonly sourceRoot: string;
  readonly workspace: string;
  readonly sourceChanged: () => boolean;
  readonly snapshotChanged: () => boolean;
  readonly cleanup: () => void;
}

const PLANNING_KNOWLEDGE_ROLES = ['principles', 'personas', 'surfaces'] as const;
type PlanningKnowledgeRole = (typeof PLANNING_KNOWLEDGE_ROLES)[number];
type RequiredPlanningContextRole = PlanningContextRole;

function planningOverrides(
  cwd: string,
  role: PlanningKnowledgeRole,
): Record<string, unknown> | undefined {
  const configPath = nodePath.join(cwd, '.safeword/config.json');
  if (!existsSync(configPath)) return undefined;
  let config: unknown;
  try {
    config = JSON.parse(readFileSync(configPath, 'utf8'));
  } catch {
    throw new PlanningContextError(role, '.safeword/config.json');
  }
  if (!planningConfigRecord(config)) throw new PlanningContextError(role, '.safeword/config.json');
  const overrides = config.paths;
  if (overrides === undefined) return undefined;
  if (!planningConfigRecord(overrides))
    throw new PlanningContextError(role, '.safeword/config.json:paths');
  return overrides;
}
function planningConfigRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function requireValidPlanningOverride(cwd: string, role: PlanningKnowledgeRole): void {
  const overrides = planningOverrides(cwd, role);
  if (overrides !== undefined && Object.hasOwn(overrides, role)) {
    const value = overrides[role];
    if (typeof value !== 'string' || value.trim() === '')
      throw new PlanningContextError(role, `.safeword/config.json:paths.${role}`);
  }
}

function requiredPlanningKnowledgeSource(cwd: string, role: PlanningKnowledgeRole): string {
  requireValidPlanningOverride(cwd, role);
  return requiredPlanningSource(cwd, role, resolveConfiguredPath(cwd, role));
}

function requiredPlanningSource(
  cwd: string,
  role: RequiredPlanningContextRole,
  source: string,
): string {
  const relative = nodePath.relative(cwd, source);
  try {
    if (escapes(cwd, source) || !lstatSync(source).isFile()) {
      throw new PlanningContextError(role, relative);
    }
    if (readFileSync(source, 'utf8').trim() === '') {
      throw new PlanningContextError(role, relative);
    }
  } catch {
    throw new PlanningContextError(role, relative);
  }
  return relative;
}

function planningTicketMetadata(
  cwd: string,
  source: string,
  role: 'ticket' | 'parent',
): Record<string, unknown> {
  const relative = requiredPlanningSource(cwd, role, source);
  try {
    return parseTicketMetadata(readFileSync(source, 'utf8')).metadata;
  } catch {
    throw new PlanningContextError(role, relative);
  }
}

function declaredPlanningParent(
  ticket: Record<string, unknown>,
  ticketPath: string,
): string | undefined {
  if (!Object.hasOwn(ticket, 'parent')) return undefined;
  const parent = ticket.parent;
  if (
    typeof parent !== 'string' ||
    parent.trim() === '' ||
    parent !== parent.trim() ||
    /[\\/]/u.test(parent) ||
    parent === '.' ||
    parent === '..' ||
    parent === ticket.id
  ) {
    throw new PlanningContextError('parent', `${ticketPath}:parent`);
  }
  return parent;
}

function requiredProductParentContext(cwd: string, targets: readonly string[]): string[] {
  const target = targets[0];
  if (target === undefined) return [];
  const ticketSource = nodePath.join(nodePath.dirname(nodePath.resolve(cwd, target)), 'ticket.md');
  const ticket = planningTicketMetadata(cwd, ticketSource, 'ticket');
  const parent = declaredPlanningParent(ticket, nodePath.relative(cwd, ticketSource));
  if (parent === undefined) return [nodePath.relative(cwd, ticketSource)];
  const tickets = resolveTicketsDirectory(cwd);
  const candidates = readdirSync(tickets, { withFileTypes: true }).filter(
    entry => entry.isDirectory() && (entry.name === parent || entry.name.startsWith(`${parent}-`)),
  );
  const directory = candidates[0];
  if (candidates.length !== 1 || directory === undefined) {
    throw new PlanningContextError(
      'parent',
      nodePath.relative(cwd, nodePath.join(tickets, parent, 'spec.md')),
    );
  }
  const parentTicket = nodePath.join(tickets, directory.name, 'ticket.md');
  const parentMetadata = planningTicketMetadata(cwd, parentTicket, 'parent');
  if (parentMetadata.id !== parent || parentMetadata.type !== 'epic') {
    throw new PlanningContextError('parent', nodePath.relative(cwd, parentTicket));
  }
  const parentSpec = requiredPlanningSource(
    cwd,
    'parent',
    nodePath.join(tickets, directory.name, 'spec.md'),
  );
  return [nodePath.relative(cwd, ticketSource), nodePath.relative(cwd, parentTicket), parentSpec];
}

function requiredDownstreamProductContext(
  cwd: string,
  targets: readonly string[],
  planName: 'impl-plan.md' | 'execution-plan.md',
): string[] | undefined {
  const target = targets[0];
  if (targets.length !== 1 || target === undefined || nodePath.basename(target) !== planName)
    return [];
  const ticketDirectory = nodePath.dirname(nodePath.resolve(cwd, target));
  if (nodePath.dirname(ticketDirectory) !== resolveTicketsDirectory(cwd)) return [];
  if (!ownedPlanningTicket(cwd, target)) return undefined;
  const inherited = requiredProductParentContext(cwd, targets);
  const product = requiredPlanningSource(cwd, 'project', nodePath.join(ticketDirectory, 'spec.md'));
  const upstream =
    planName === 'execution-plan.md'
      ? [
          requiredPlanningSource(
            cwd,
            'accepted-upstream-plan',
            nodePath.join(ticketDirectory, 'impl-plan.md'),
          ),
        ]
      : [];
  return [...inherited, product, ...upstream];
}

function requiredPlanningBoundaryContext(
  cwd: string,
  kind: ReviewKind,
  targets: readonly string[],
  context: readonly string[],
  productPlan: boolean,
): string[] | undefined {
  if (productPlan) return requiredProductParentContext(cwd, targets);
  if (kind === 'scenario-gate') {
    const spec = context[0];
    if (
      spec === undefined ||
      nodePath.basename(spec) !== 'spec.md' ||
      !ownedPlanningTicket(cwd, spec)
    )
      return undefined;
    const inherited = requiredProductParentContext(cwd, [spec]);
    requiredPlanningSource(cwd, 'project', nodePath.resolve(cwd, spec));
    return inherited;
  }
  if (kind !== 'plan-implementation' && kind !== 'plan-execution') return undefined;
  const planName = kind === 'plan-implementation' ? 'impl-plan.md' : 'execution-plan.md';
  return requiredDownstreamProductContext(cwd, targets, planName);
}

function resolvedPlanningContext(
  cwd: string,
  kind: ReviewKind,
  targets: readonly string[],
  context: readonly string[],
  productPlan = false,
): readonly string[] {
  const inherited = requiredPlanningBoundaryContext(cwd, kind, targets, context, productPlan);
  if (inherited === undefined) return context;
  const included = new Set([...targets, ...context].map(path => nodePath.resolve(cwd, path)));
  const resolved = [...context];
  const required = [
    ...inherited,
    ...PLANNING_KNOWLEDGE_ROLES.map(role => requiredPlanningKnowledgeSource(cwd, role)),
  ];
  for (const path of required) {
    const absolute = nodePath.resolve(cwd, path);
    if (!included.has(absolute)) {
      resolved.push(path);
      included.add(absolute);
    }
  }
  if (targets.length + resolved.length > MAX_FILE_COUNT) {
    throw new ReviewPacketError(`Review packet exceeds the ${MAX_FILE_COUNT}-file limit`);
  }
  return resolved;
}

export class PlanningContractCopyError extends ReviewPacketError {
  constructor(
    readonly code: 'canonical_contract_copy_mismatch' | 'missing_generated_contract_copy',
    readonly phase: PlanningPhase,
    readonly contractPath: string,
  ) {
    const generator = {
      'product-plan': 'generate:planning-contracts',
      'plan-implementation': 'generate:plan-rubric',
      'plan-execution': 'generate:execution-plan-rubric',
    }[phase];
    super(
      `The ${phase} authoring contract copy at ${contractPath} ${code === 'missing_generated_contract_copy' ? 'is unavailable' : 'differs from the canonical contract-byte identity'}. Restore the packaged decision-quality contract by reinstalling or reconciling the intact Safeword distribution and retry. For source builds, restore the canonical authoring contract, run \`bun run ${generator}\` and \`bun run fix:generated-surfaces\`, then rebuild and reinstall.`,
    );
  }
}

declare const __SAFEWORD_PACKAGE_PLANNING_AUTHOR_COPIES__:
  Readonly<Record<PlanningPhase, PlanningAuthorCopyIdentity>> | undefined;

function readPlanningAuthor(
  root: string,
  phase: PlanningPhase,
  identity: PlanningAuthorCopyIdentity,
): string {
  let bytes: Buffer;
  try {
    bytes = readFileSync(nodePath.join(root, identity.relativePath));
  } catch {
    throw new PlanningContractCopyError(
      'missing_generated_contract_copy',
      phase,
      identity.relativePath,
    );
  }
  if (digest(bytes) !== identity.sha256) {
    throw new PlanningContractCopyError(
      'canonical_contract_copy_mismatch',
      phase,
      identity.relativePath,
    );
  }
  return bytes.toString('utf8');
}

function packagedPlanningAuthor(phase: PlanningPhase): string {
  const copies =
    typeof __SAFEWORD_PACKAGE_PLANNING_AUTHOR_COPIES__ === 'object'
      ? __SAFEWORD_PACKAGE_PLANNING_AUTHOR_COPIES__
      : PLANNING_AUTHOR_COPIES;
  return readPlanningAuthor(packageRoot(), phase, copies[phase]);
}

/** Raw author-copy integrity is separate from the authenticated reviewer verdict. */
export function assertActivePlanningAuthorCopy(cwd: string, phase: PlanningPhase): void {
  packagedPlanningAuthor(phase);
  if (process.env.SAFEWORD_AGENT_RUNTIME !== 'cursor') return;
  const identity = PLANNING_AUTHOR_COPIES[phase];
  const template = identity.relativePath.replace(/^templates\//u, '');
  readPlanningAuthor(cwd, phase, {
    relativePath: cursorPlanningContractPath(template),
    sha256: identity.sha256,
  });
}

interface CapturedFile {
  readonly source: string;
  readonly snapshot: string;
  readonly sha256: string;
  readonly device: number;
  readonly inode: number;
}

function requireScenarioTicketSpec(
  kind: ReviewKind,
  contextFiles: readonly { readonly path: string; readonly content: string }[],
): void {
  if (kind !== 'scenario-gate') return;
  const ticketSpec = contextFiles[0];
  if (
    ticketSpec === undefined ||
    nodePath.basename(ticketSpec.path) !== 'spec.md' ||
    ticketSpec.content.trim() === ''
  ) {
    throw new ReviewPacketError(
      'Scenario-gate review requires a non-blank spec.md as its first context file',
    );
  }
}

function requirePlanWorkArtifact(
  kind: ReviewKind,
  logicalFiles: readonly { readonly path: string; readonly content: string }[],
): void {
  if (kind !== 'plan-implementation') return;
  const plan = logicalFiles[0];
  if (
    logicalFiles.length !== 1 ||
    plan === undefined ||
    nodePath.basename(plan.path) !== 'impl-plan.md' ||
    plan.content.trim() === ''
  ) {
    throw new ReviewPacketError(
      'Plan-implementation review requires one non-blank impl-plan.md work file; pass supporting evidence with --context',
    );
  }
}

function requireExecutionPlanWorkArtifact(
  kind: ReviewKind,
  logicalFiles: readonly { readonly path: string; readonly content: string }[],
  contextFiles: readonly { readonly path: string; readonly content: string }[],
): void {
  if (kind !== 'plan-execution') return;
  const plan = logicalFiles[0];
  if (
    logicalFiles.length !== 1 ||
    plan === undefined ||
    nodePath.basename(plan.path) !== 'execution-plan.md' ||
    plan.content.trim() === ''
  ) {
    throw new ReviewPacketError(
      'Plan-execution review requires one non-blank execution-plan.md work file; pass supporting evidence with --context',
    );
  }
  const implementationPlan = contextFiles.find(
    file => nodePath.basename(file.path) === 'impl-plan.md' && file.content.trim() !== '',
  );
  const scenarios = contextFiles.find(
    file => nodePath.extname(file.path) === '.feature' && file.content.trim() !== '',
  );
  if (implementationPlan === undefined || scenarios === undefined) {
    throw new ReviewPacketError(
      'Plan-execution review requires a non-blank impl-plan.md and approved .feature scenarios as context',
    );
  }
}

function designApprovalGate(root: string): boolean {
  const configPath = nodePath.join(root, '.safeword', 'config.json');
  if (!existsSync(configPath)) return false;
  try {
    const value: unknown = JSON.parse(readFileSync(configPath, 'utf8'));
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('configuration root is not an object');
    }
    return (value as { readonly designApprovalGate?: unknown }).designApprovalGate === true;
  } catch {
    throw new ReviewPacketError(
      'Plan-execution review cannot read designApprovalGate from .safeword/config.json.',
    );
  }
}

function retainedDeliveryDefinition(
  kind: ReviewKind,
  logicalFiles: readonly { readonly content: string }[],
  root: string,
): ExecutionPlanDeliveryDefinition | undefined {
  if (kind !== 'plan-execution') return undefined;
  if (!hasCanonicalDeliveryContractIdentity()) {
    throw new ReviewPacketError(
      'Plan-execution review refused: installed package differs from the canonical delivery-contract identity.',
    );
  }
  const plan = logicalFiles[0];
  if (plan === undefined) return undefined;
  const parsed = parseDeliveryPlanContract(plan.content);
  if (!parsed.ok) throw new ReviewPacketError(`Plan-execution review refused: ${parsed.message}`);
  return createExecutionPlanDeliveryDefinition(parsed, designApprovalGate(root));
}

function designApprovalConfigChanged(
  kind: ReviewKind,
  root: string,
  retained: ExecutionPlanDeliveryDefinition | undefined,
): boolean {
  if (kind !== 'plan-execution' || retained === undefined) return false;
  try {
    return designApprovalGate(root) !== retained.design_approval_gate;
  } catch {
    return true;
  }
}

function packetDeliveryDefinition(definition: ExecutionPlanDeliveryDefinition | undefined): {
  readonly execution_plan_delivery_definition?: ExecutionPlanDeliveryDefinition;
} {
  return definition === undefined ? {} : { execution_plan_delivery_definition: definition };
}

function packetNormalizedPlanDigest(
  kind: ReviewKind,
  logicalFiles: readonly { readonly content: string }[],
): { readonly execution_plan_normalized_digest?: string } {
  const plan = logicalFiles[0];
  return kind === 'plan-execution' && plan !== undefined
    ? { execution_plan_normalized_digest: normalizedExecutionPlanDigest(plan.content) }
    : {};
}

function requireExecutableRedAttestation(
  kind: ReviewKind,
  attestation: RedExecutionAttestation | undefined,
): void {
  if (kind === 'executable-red' && attestation === undefined) {
    throw new ReviewPacketError('Executable-red review requires a trusted execution attestation');
  }
  if (kind !== 'executable-red' && attestation !== undefined) {
    throw new ReviewPacketError(
      'Trusted execution attestations are accepted only for executable-red review',
    );
  }
}

interface ReviewPacketExecution {
  readonly attestation?: RedExecutionAttestation;
  readonly planContract?: PlanContractPair;
  /** Fingerprint preparation only: no review is dispatched from this packet. */
  readonly allowMissingExecutableRedAttestation?: boolean;
}

function checkedExecutionAttestation(
  kind: ReviewKind,
  execution: ReviewPacketExecution,
): RedExecutionAttestation | undefined {
  if (kind !== 'executable-red' || execution.allowMissingExecutableRedAttestation !== true) {
    requireExecutableRedAttestation(kind, execution.attestation);
  }
  return execution.attestation;
}

export function planningPacketError(
  error: unknown,
): PlanningContractCopyError | PlanningContextError | undefined {
  return error instanceof PlanningContractCopyError || error instanceof PlanningContextError
    ? error
    : undefined;
}

function digest(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

function planObligations(contract: string): string[] {
  return Array.from(contract.matchAll(/^- \*\*([^*]+):\*\*/gmu), match => match[1]?.trim() ?? '');
}

/** Build the byte identities shared by plan authors and reviewers. */
export function assemblePlanContract(
  authorRubric?: string,
  reviewerRubric?: string,
): PlanContractPair {
  if (authorRubric === undefined || authorRubric.trim() === '') {
    throw new ReviewPacketError('The authoring contract copy is missing or blank.');
  }
  if (reviewerRubric === undefined || reviewerRubric.trim() === '') {
    throw new ReviewPacketError('The generated reviewer contract copy is missing or blank.');
  }
  return {
    author: { sha256: digest(authorRubric), obligations: planObligations(authorRubric) },
    reviewer: { sha256: digest(reviewerRubric), obligations: planObligations(reviewerRubric) },
  };
}

function packageRoot(): string {
  const runtimeDirectory = nodePath.basename(import.meta.dirname);
  return runtimeDirectory === 'dist' || runtimeDirectory === 'runtime'
    ? nodePath.dirname(import.meta.dirname)
    : nodePath.resolve(import.meta.dirname, '../..');
}

function packagedPlanAuthorRubric(): string {
  const source = packagedPlanningAuthor('plan-implementation');
  try {
    return extractPlanReviewRubric(source);
  } catch {
    throw new ReviewPacketError(
      'The packaged decision-quality contract is unavailable, so Safeword cannot author or approve an Implementation Plan. Run `bun run generate:plan-rubric`, rebuild the Safeword package, and retry.',
    );
  }
}

function packagedExecutionPlanAuthorRubric(): string {
  const source = packagedPlanningAuthor('plan-execution');
  try {
    return extractExecutionPlanReviewRubric(source);
  } catch {
    throw new ReviewPacketError(
      'The packaged Execution Planning authoring contract copy is unavailable, so Safeword cannot author or approve an Execution Plan. Run `bun run generate:execution-plan-rubric`, rebuild the Safeword package, and retry.',
    );
  }
}

export function packagedPlanContract(
  kind: 'plan-implementation' | 'plan-execution',
): PlanContractPair {
  const authorRubric =
    kind === 'plan-execution' ? packagedExecutionPlanAuthorRubric() : packagedPlanAuthorRubric();
  const reviewerRubric =
    kind === 'plan-execution' ? EXECUTION_PLAN_REVIEW_RUBRIC : PLAN_REVIEW_RUBRIC;
  return assemblePlanContract(authorRubric, reviewerRubric);
}

function productPlanWorkTarget(
  root: string,
  kind: ReviewKind,
  files: readonly { readonly path: string; readonly content: string }[],
): boolean {
  if (kind !== 'quality-review' || files.length !== 1) return false;
  const target = files[0];
  if (target === undefined || nodePath.basename(target.path) !== 'spec.md') return false;
  const ticketDirectory = nodePath.dirname(nodePath.resolve(root, target.path));
  if (nodePath.dirname(ticketDirectory) !== resolveTicketsDirectory(root)) return false;
  const ticketPath = nodePath.join(ticketDirectory, 'ticket.md');
  const relativeTicketPath = nodePath.relative(root, ticketPath);
  const markedProductPlan = target.content.includes('<!-- safeword:product-plan-contract:v1 -->');
  let metadata: Record<string, unknown>;
  try {
    metadata = parseTicketMetadata(readFileSync(ticketPath, 'utf8')).metadata;
  } catch {
    if (markedProductPlan) throw new PlanningContextError('ticket', relativeTicketPath);
    return false;
  }
  if (metadata.product_plan_contract !== 'v1') {
    if (markedProductPlan) throw new PlanningContextError('ticket', relativeTicketPath);
    return false;
  }
  return planningTicketOwner(metadata, nodePath.basename(ticketDirectory), relativeTicketPath);
}

function ownedPlanningTicket(root: string, target: string): boolean {
  const ticketDirectory = nodePath.dirname(nodePath.resolve(root, target));
  if (nodePath.dirname(ticketDirectory) !== resolveTicketsDirectory(root)) return false;
  const ticketPath = nodePath.join(ticketDirectory, 'ticket.md');
  const metadata = planningTicketMetadata(root, ticketPath, 'ticket');
  return planningTicketOwner(
    metadata,
    nodePath.basename(ticketDirectory),
    nodePath.relative(root, ticketPath),
  );
}

function packagedProductPlanContract(): PlanContractPair {
  return assemblePlanContract(
    extractProductPlanReviewRubric(packagedPlanningAuthor('product-plan')),
    PRODUCT_PLAN_REVIEW_RUBRIC,
  );
}

function packetPlanContract(
  kind: ReviewKind,
  configured: PlanContractPair | undefined,
  productTarget: boolean,
  cwd: string,
  targets: readonly string[],
): Pick<ReviewPacket, 'planning_phase' | 'plan_contract'> {
  if (productTarget)
    return { planning_phase: 'product-plan', plan_contract: packagedProductPlanContract() };
  if (kind !== 'plan-implementation' && kind !== 'plan-execution') return {};
  const canonical = packagedPlanContract(kind);
  const target = targets.length === 1 ? targets[0] : undefined;
  const expected = kind === 'plan-implementation' ? 'impl-plan.md' : 'execution-plan.md';
  const planningTarget =
    target !== undefined &&
    nodePath.basename(target) === expected &&
    ownedPlanningTicket(cwd, target);
  return {
    ...(planningTarget && { planning_phase: kind }),
    plan_contract: configured ?? canonical,
  };
}

function fileDigest(path: string): string | undefined {
  try {
    return digest(readFileSync(path));
  } catch {
    // Integrity checks fail closed: deletion and unreadability both mean the
    // source can no longer be proven equal to the captured packet.
    return undefined;
  }
}

function sourceFileChanged(file: CapturedFile): boolean {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(file.source, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const current = fstatSync(descriptor);
    return (
      !current.isFile() ||
      current.dev !== file.device ||
      current.ino !== file.inode ||
      digest(readFileSync(descriptor)) !== file.sha256
    );
  } catch {
    return true;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function readContainedText(
  root: string,
  source: string,
  target: string,
  packetBytesRemaining: number,
): {
  readonly bytes: Buffer;
  readonly content: string;
  readonly device: number;
  readonly inode: number;
} {
  const descriptor = openSync(source, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = fstatSync(descriptor);
    if (!opened.isFile()) throw new Error(`Review target is not a regular file: ${target}`);
    if (opened.size > MAX_FILE_BYTES) {
      throw new Error(`Review target exceeds the ${MAX_FILE_BYTES}-byte limit: ${target}`);
    }
    if (opened.size > packetBytesRemaining) {
      throw new Error(`Review packet exceeds the ${MAX_PACKET_BYTES}-byte limit`);
    }
    const resolved = realpathSync(source);
    if (escapes(root, resolved)) throw new Error(`Review target escapes the project: ${target}`);
    const observed = lstatSync(resolved);
    if (opened.dev !== observed.dev || opened.ino !== observed.ino) {
      throw new Error(`Review target changed while it was being captured: ${target}`);
    }
    const bytes = readFileSync(descriptor);
    let content: string;
    try {
      content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      throw new Error(`Review target is not valid UTF-8 text: ${target}`);
    }
    if (HIGH_CONFIDENCE_SECRET_PATTERNS.some(pattern => pattern.test(content))) {
      throw new Error(
        `Review packet rejected a high-confidence credential in ${target}; redact it before dispatch`,
      );
    }
    return { bytes, content, device: opened.dev, inode: opened.ino };
  } finally {
    closeSync(descriptor);
  }
}

function escapes(root: string, candidate: string): boolean {
  const relative = nodePath.relative(root, candidate);
  return (
    relative === '..' || relative.startsWith(`..${nodePath.sep}`) || nodePath.isAbsolute(relative)
  );
}

function snapshotEntries(root: string, directory = root): string[] {
  return readdirSync(directory).flatMap(name => {
    const path = nodePath.join(directory, name);
    const relative = nodePath.relative(root, path);
    const stats = lstatSync(path);
    if (stats.isDirectory()) return [`directory:${relative}`, ...snapshotEntries(root, path)];
    if (stats.isFile()) return [`file:${relative}`];
    return [`other:${relative}`];
  });
}

function planningRoleSources(
  cwd: string,
  context: PlanningRoleContext | undefined,
  included: ReadonlySet<string>,
): string[] {
  const sources = context?.dependencies.map(source =>
    requiredPlanningSource(cwd, source.role, nodePath.resolve(cwd, source.path)),
  );
  return [...new Set(sources).difference(included)];
}

function requirePacketFileCount(count: number): void {
  if (count > MAX_FILE_COUNT)
    throw new ReviewPacketError(`Review packet exceeds the ${MAX_FILE_COUNT}-file limit`);
}

function packetPlanningContext(context: PlanningRoleContext | undefined): Partial<ReviewPacket> {
  return context === undefined ? {} : { planning_context: context };
}

function packetRoleFile(
  context: PlanningRoleContext | undefined,
  files: readonly { readonly path: string; readonly content: string }[],
  role: 'ticket' | 'project',
): { readonly path: string; readonly content: string } | undefined {
  const path = context?.dependencies.find(source => source.role === role)?.path;
  if (path === undefined) return undefined;
  const file = files.find(candidate => candidate.path === path);
  if (file === undefined) throw new PlanningContextError(role, path);
  return file;
}

function packetDispositionContext(
  kind: ReviewKind,
  context: PlanningRoleContext | undefined,
  files: readonly { readonly path: string; readonly content: string }[],
): Partial<ReviewPacket> {
  const ticket = packetRoleFile(context, files, 'ticket');
  if (ticket === undefined) return {};
  if (parseTicketMetadata(ticket.content).metadata.review_dispositions === undefined) return {};
  const project = packetRoleFile(context, files, 'project');
  if (project === undefined) throw new PlanningContextError('project', 'spec.md');
  try {
    const disposition = reviewDispositionContext(ticket.content, project.content, kind);
    return disposition === undefined ? {} : { review_disposition_context: disposition };
  } catch {
    throw new PlanningContextError('ticket', ticket.path);
  }
}

function validatePlanEvidenceRecords(
  kind: ReviewKind,
  files: readonly { readonly path: string; readonly content: string }[],
): void {
  if (kind !== 'plan-implementation' && kind !== 'plan-execution') return;
  for (const file of files)
    if (nodePath.basename(file.path) === 'impl-plan.md') planningEvidenceRecords(file.content);
}

function prepareReviewPacketUnsafe(
  cwd: string,
  kind: ReviewKind,
  targets: readonly string[],
  context: readonly string[] = [],
  execution: ReviewPacketExecution = {},
): PreparedReviewPacket {
  if (targets.length + context.length > MAX_FILE_COUNT) {
    throw new Error(`Review packet exceeds the ${MAX_FILE_COUNT}-file limit`);
  }
  const executionAttestation = checkedExecutionAttestation(kind, execution);
  const canonicalRoot = realpathSync(cwd);
  const workspace = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-'));
  const tracked: CapturedFile[] = [];
  const expectedSnapshotEntries = new Set<string>();
  let logicalFiles: { path: string; content: string }[];
  let contextFiles: { path: string; content: string }[];
  let deliveryDefinition: ExecutionPlanDeliveryDefinition | undefined;
  let planningContract: ReturnType<typeof packetPlanContract>;
  let planningContext: PlanningRoleContext | undefined;
  try {
    let packetBytes = 0;
    const captureFiles = (files: readonly string[]): { path: string; content: string }[] =>
      files.map(target => {
        const source = nodePath.resolve(canonicalRoot, target);
        const relative = nodePath.relative(canonicalRoot, source);
        if (escapes(canonicalRoot, source)) {
          throw new Error(`Review target escapes the project: ${target}`);
        }
        const stats = lstatSync(source);
        if (!stats.isFile()) {
          throw new Error(`Review target is not a regular file: ${target}`);
        }
        // A hard link inside the project is intentionally treated as a regular
        // in-project file; containment is path-based, and its bytes are copied.
        const { bytes, content, device, inode } = readContainedText(
          canonicalRoot,
          source,
          target,
          MAX_PACKET_BYTES - packetBytes,
        );
        const fileBytes = bytes.byteLength;
        if (fileBytes > MAX_FILE_BYTES) {
          throw new Error(`Review target exceeds the ${MAX_FILE_BYTES}-byte limit: ${target}`);
        }
        packetBytes += fileBytes;
        if (packetBytes > MAX_PACKET_BYTES) {
          throw new Error(`Review packet exceeds the ${MAX_PACKET_BYTES}-byte limit`);
        }
        const snapshot = nodePath.join(workspace, relative);
        mkdirSync(nodePath.dirname(snapshot), { recursive: true });
        writeFileSync(snapshot, bytes, { mode: 0o600 });
        let parent = nodePath.dirname(relative);
        while (parent !== '.') {
          expectedSnapshotEntries.add(`directory:${parent}`);
          parent = nodePath.dirname(parent);
        }
        expectedSnapshotEntries.add(`file:${relative}`);
        tracked.push({ source, snapshot, sha256: digest(bytes), device, inode });
        return { path: relative, content };
      });
    const seen = new Set<string>();
    const rejectDuplicate = (target: string): void => {
      const relative = nodePath.relative(canonicalRoot, nodePath.resolve(canonicalRoot, target));
      if (seen.has(relative)) {
        throw new Error(`Review packet contains a duplicate file: ${target}`);
      }
      seen.add(relative);
    };
    for (const target of targets) rejectDuplicate(target);
    logicalFiles = captureFiles(targets);
    const productPlan = productPlanWorkTarget(canonicalRoot, kind, logicalFiles);
    context = resolvedPlanningContext(canonicalRoot, kind, targets, context, productPlan);
    for (const target of context) rejectDuplicate(target);
    contextFiles = captureFiles(context);
    validatePlanEvidenceRecords(kind, [...logicalFiles, ...contextFiles]);
    requireScenarioTicketSpec(kind, contextFiles);
    requirePlanWorkArtifact(kind, logicalFiles);
    requireExecutionPlanWorkArtifact(kind, logicalFiles, contextFiles);
    deliveryDefinition = retainedDeliveryDefinition(kind, logicalFiles, canonicalRoot);
    planningContract = packetPlanContract(
      kind,
      execution.planContract,
      productPlan,
      canonicalRoot,
      targets,
    );
    planningContext = resolvePlanningRoleContext(
      canonicalRoot,
      kind,
      planningContract.planning_phase,
      logicalFiles,
      contextFiles,
    );
    const additional = planningRoleSources(canonicalRoot, planningContext, seen);
    requirePacketFileCount(targets.length + context.length + additional.length);
    contextFiles.push(...captureFiles(additional));
  } catch (error) {
    rmSync(workspace, { recursive: true, force: true });
    throw error;
  }
  const packet: ReviewPacket = {
    schema_version: 1,
    dispatch_id: randomUUID(),
    kind,
    logical_files: logicalFiles,
    ...(contextFiles.length > 0 && { context_files: contextFiles }),
    ...planningContract,
    ...packetPlanningContext(planningContext),
    ...packetDispositionContext(kind, planningContext, [...logicalFiles, ...contextFiles]),
    ...packetDeliveryDefinition(deliveryDefinition),
    ...packetNormalizedPlanDigest(kind, logicalFiles),
    ...(executionAttestation !== undefined && { execution_attestation: executionAttestation }),
  };
  if (Buffer.byteLength(JSON.stringify(packet), 'utf8') > MAX_PACKET_BYTES) {
    rmSync(workspace, { recursive: true, force: true });
    throw new ReviewPacketError(`Review packet exceeds the ${MAX_PACKET_BYTES}-byte limit`);
  }
  return {
    packet,
    sourceRoot: canonicalRoot,
    workspace,
    sourceChanged: () =>
      tracked.some(file => sourceFileChanged(file)) ||
      designApprovalConfigChanged(kind, canonicalRoot, deliveryDefinition),
    snapshotChanged: () => {
      if (tracked.some(file => fileDigest(file.snapshot) !== file.sha256)) return true;
      try {
        const actualEntries = snapshotEntries(workspace);
        return (
          actualEntries.length !== expectedSnapshotEntries.size ||
          actualEntries.some(entry => !expectedSnapshotEntries.has(entry))
        );
      } catch {
        return true;
      }
    },
    cleanup: () => {
      rmSync(workspace, { recursive: true, force: true });
    },
  };
}

export function prepareReviewPacket(
  cwd: string,
  kind: ReviewKind,
  targets: readonly string[],
  context: readonly string[] = [],
  execution: ReviewPacketExecution = {},
): PreparedReviewPacket {
  try {
    return prepareReviewPacketUnsafe(cwd, kind, targets, context, execution);
  } catch (error) {
    if (error instanceof ReviewPacketError) throw error;
    const message = error instanceof Error ? error.message : '';
    throw new ReviewPacketError(
      message.startsWith('Review ')
        ? message
        : 'Review packet could not be prepared. Check that every target and context path exists and is readable.',
    );
  }
}
