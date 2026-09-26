import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync,
  constants,
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

import { executionPlanDeliveryDefinition } from '../execution-plan/delivery-definition.js';
import {
  executionPlanDesignApprovalGate,
  normalizedExecutionPlanDigest,
} from '../execution-plan/review-identity.js';
import { resolveTicketsDirectory } from '../utils/configured-paths.js';
import type {
  ExecutionPlanDeliveryDefinition,
  RedExecutionAttestation,
  ReviewKind,
  ReviewPacket,
} from './contract.js';

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

function isTicketOwnedExecutionPlan(root: string, path: string): boolean {
  const relative = nodePath.relative(resolveTicketsDirectory(root), nodePath.join(root, path));
  const parts = relative.split(nodePath.sep);
  return (
    parts.length === 2 && parts[0] !== '..' && parts[0] !== '' && parts[1] === 'execution-plan.md'
  );
}

function hasTicketContext(
  contextFiles: readonly { readonly path: string; readonly content: string }[],
  directory: string,
  matchingPath: (path: string) => boolean,
): boolean {
  return contextFiles.some(
    file =>
      nodePath.dirname(file.path) === directory &&
      matchingPath(file.path) &&
      file.content.trim() !== '',
  );
}

function isInsideTicket(ticketDirectory: string, path: string): boolean {
  const relative = nodePath.relative(ticketDirectory, path);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${nodePath.sep}`);
}

function requireExecutionPlanWorkArtifact(
  kind: ReviewKind,
  root: string,
  logicalFiles: readonly { readonly path: string; readonly content: string }[],
  contextFiles: readonly { readonly path: string; readonly content: string }[],
): void {
  if (kind !== 'plan-execution') return;
  const plan = logicalFiles[0];
  if (
    logicalFiles.length !== 1 ||
    plan === undefined ||
    plan.content.trim() === '' ||
    !isTicketOwnedExecutionPlan(root, plan.path)
  ) {
    throw new ReviewPacketError(
      'Plan-execution review requires one ticket-owned execution-plan.md work file',
    );
  }
  const ticketDirectory = nodePath.dirname(plan.path);
  const hasImplementationPlan = hasTicketContext(
    contextFiles,
    ticketDirectory,
    path => nodePath.basename(path) === 'impl-plan.md',
  );
  const hasScenarios = contextFiles.some(
    file =>
      isInsideTicket(ticketDirectory, file.path) &&
      nodePath.extname(file.path) === '.feature' &&
      file.content.trim() !== '',
  );
  if (!hasImplementationPlan || !hasScenarios) {
    throw new ReviewPacketError(
      'Plan-execution review requires a non-blank impl-plan.md and approved .feature scenarios as context',
    );
  }
}

function executionPlanMetadata(
  kind: ReviewKind,
  root: string,
  logicalFiles: readonly { readonly content: string }[],
): {
  readonly gate?: boolean;
  readonly definition?: ExecutionPlanDeliveryDefinition;
  readonly digest?: string;
} {
  if (kind !== 'plan-execution') return {};
  const plan = logicalFiles[0];
  if (plan === undefined) throw new ReviewPacketError('Execution Plan work file is missing');
  try {
    const gate = executionPlanDesignApprovalGate(root);
    return {
      gate,
      definition: executionPlanDeliveryDefinition(plan.content, gate),
      digest: normalizedExecutionPlanDigest(plan.content),
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'invalid delivery definition';
    throw new ReviewPacketError(`Plan-execution review refused: ${reason}`);
  }
}

function executionPlanConfigChanged(root: string, gate: boolean | undefined): boolean {
  if (gate === undefined) return false;
  try {
    return executionPlanDesignApprovalGate(root) !== gate;
  } catch {
    return true;
  }
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

function requireBoundedFileCount(targets: readonly string[], context: readonly string[]): void {
  if (targets.length + context.length > MAX_FILE_COUNT) {
    throw new Error(`Review packet exceeds the ${MAX_FILE_COUNT}-file limit`);
  }
}

function prepareReviewPacketUnsafe(
  cwd: string,
  kind: ReviewKind,
  targets: readonly string[],
  context: readonly string[] = [],
  execution: ReviewPacketExecution = {},
): PreparedReviewPacket {
  requireBoundedFileCount(targets, context);
  const executionAttestation = checkedExecutionAttestation(kind, execution);
  const canonicalRoot = realpathSync(cwd);
  const workspace = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-'));
  const tracked: CapturedFile[] = [];
  const expectedSnapshotEntries = new Set<string>();
  let logicalFiles: { path: string; content: string }[];
  let contextFiles: { path: string; content: string }[];
  let executionPlan: ReturnType<typeof executionPlanMetadata>;
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
    requireExecutionPlanWorkArtifact(kind, canonicalRoot, logicalFiles, contextFiles);
    executionPlan = executionPlanMetadata(kind, canonicalRoot, logicalFiles);
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
    ...(executionPlan.definition !== undefined && {
      execution_plan_delivery_definition: executionPlan.definition,
      execution_plan_normalized_digest: executionPlan.digest,
    }),
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
    sourceChanged: () => {
      if (tracked.some(file => sourceFileChanged(file))) return true;
      return executionPlanConfigChanged(canonicalRoot, executionPlan.gate);
    },
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
