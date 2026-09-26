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
import { resolveTicketsDirectory } from '../utils/configured-paths.js';
import { readFrontmatterScalar } from '../utils/frontmatter.js';
import type {
  ExecutionPlanDeliveryDefinition,
  PlanContractPair,
  RedExecutionAttestation,
  ReviewKind,
  ReviewPacket,
} from './contract.js';
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

export class ReviewPacketError extends Error {
  readonly name = 'ReviewPacketError';
}

export class PlanningContractCopyError extends ReviewPacketError {
  constructor(
    readonly code: 'canonical_contract_copy_mismatch' | 'missing_generated_contract_copy',
    readonly phase: PlanningPhase,
    readonly contractPath: string,
  ) {
    super(
      `The ${phase} authoring contract copy at ${contractPath} ${code === 'missing_generated_contract_copy' ? 'is unavailable' : 'differs from the canonical contract-byte identity'}. Reconcile the canonical generated contract and retry.`,
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
  files: readonly { readonly path: string }[],
): boolean {
  if (kind !== 'quality-review' || files.length !== 1) return false;
  const target = files[0];
  if (target === undefined || nodePath.basename(target.path) !== 'spec.md') return false;
  const ticketDirectory = nodePath.dirname(nodePath.resolve(root, target.path));
  if (nodePath.dirname(ticketDirectory) !== resolveTicketsDirectory(root)) return false;
  const ticketPath = nodePath.join(ticketDirectory, 'ticket.md');
  if (!existsSync(ticketPath)) return false;
  return productPlanOwner(readFileSync(ticketPath, 'utf8'), nodePath.basename(ticketDirectory));
}

function productPlanOwner(ticket: string, folder: string): boolean {
  const type = readFrontmatterScalar(ticket, 'type');
  if (type !== 'feature' && type !== 'epic') return false;
  const id = readFrontmatterScalar(ticket, 'id');
  return (
    id !== undefined &&
    (folder === id || folder.startsWith(`${id}-`)) &&
    readFrontmatterScalar(ticket, 'product_plan_contract') === 'v1'
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
): { readonly planning_phase?: 'product-plan'; readonly plan_contract?: PlanContractPair } {
  if (productTarget)
    return { planning_phase: 'product-plan', plan_contract: packagedProductPlanContract() };
  if (kind !== 'plan-implementation' && kind !== 'plan-execution') return {};
  const canonical = packagedPlanContract(kind);
  return { plan_contract: configured ?? canonical };
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
    for (const target of context) rejectDuplicate(target);
    logicalFiles = captureFiles(targets);
    contextFiles = captureFiles(context);
    requireScenarioTicketSpec(kind, contextFiles);
    requirePlanWorkArtifact(kind, logicalFiles);
    requireExecutionPlanWorkArtifact(kind, logicalFiles, contextFiles);
    deliveryDefinition = retainedDeliveryDefinition(kind, logicalFiles, canonicalRoot);
    planningContract = packetPlanContract(
      kind,
      execution.planContract,
      productPlanWorkTarget(canonicalRoot, kind, logicalFiles),
    );
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
