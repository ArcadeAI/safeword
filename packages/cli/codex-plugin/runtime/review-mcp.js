// @bun
// src/codex-plugin/review-mcp.ts
import { realpathSync as realpathSync3, statSync as statSync2 } from "fs";
import nodePath3 from "path";
import readline from "readline";

// src/review/job.ts
import { spawn, spawnSync } from "child_process";
import { createHash as createHash2, createHmac, randomBytes, randomUUID as randomUUID2, timingSafeEqual } from "crypto";
import {
  closeSync as closeSync2,
  existsSync,
  fstatSync as fstatSync2,
  mkdirSync as mkdirSync2,
  openSync as openSync2,
  readdirSync as readdirSync2,
  readFileSync as readFileSync2,
  realpathSync as realpathSync2,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync as writeFileSync2,
  writeSync
} from "fs";
import { homedir } from "os";
import nodePath2 from "path";

// src/cli-protocol/policy.ts
function createBestEffortByteSink(write) {
  return (buffer) => {
    let offset = 0;
    try {
      while (offset < buffer.length) {
        const written = write(buffer, offset, buffer.length - offset);
        if (!Number.isSafeInteger(written) || written <= 0 || written > buffer.length - offset) {
          return;
        }
        offset += written;
      }
    } catch {}
  };
}

// src/cli-protocol/review-presentation.ts
var REVIEW_AGENTS = new Set(["claude", "codex", "opencode"]);
var REVIEW_AUTHORS = new Set(["claude", "codex", "cursor", "opencode"]);
var REPLACED_REVIEW_FINDINGS = new Set([
  "REVIEW_INDEPENDENCE",
  "REVIEW_NOT_REQUESTED",
  "REVIEW_STALE"
]);
var RETRYABLE_REVIEW_FAILURES = new Set([
  "timed_out",
  "process_failed",
  "invalid_output",
  "REVIEWER_PROVENANCE_MISSING",
  "REVIEWER_PROVENANCE_CONTRADICTORY"
]);

// src/cli-protocol/result.ts
var EMPTY_EFFECTS = {
  files: [],
  packages: [],
  configuration: [],
  network: [],
  destructive: []
};
function createResult(input) {
  return {
    schemaVersion: 1,
    ok: input.state !== "failed",
    state: input.state,
    changed: input.changed ?? input.state === "changed",
    findings: input.findings ?? [],
    effects: { ...EMPTY_EFFECTS, ...input.effects },
    errors: input.errors ?? [],
    recovery: input.recovery ?? [],
    nextActions: input.nextActions ?? [],
    ...input.exitCode !== undefined && { exitCode: input.exitCode },
    ...input.presentation !== undefined && { presentation: input.presentation },
    ...input.data !== undefined && { data: input.data }
  };
}

// src/review/command.ts
function shellQuote(value) {
  if (/^[\w./-]+$/u.test(value))
    return value;
  const escaped = value.replaceAll("'", `'"'"'`);
  return `'${escaped}'`;
}
function contextArgument(target) {
  return `--context ${shellQuote(target)}`;
}
function retryCommand(kind, targets, context = [], execution) {
  const quoted = targets.map((target) => shellQuote(target)).join(" ");
  const contextOption = context.length === 0 ? "" : ` ${context.map((target) => contextArgument(target)).join(" ")}`;
  const executionOptions = execution === undefined ? "" : [
    ` --scenario ${shellQuote(execution.scenario)}`,
    ` --ledger ${shellQuote(execution.ledger)}`,
    ` --proof-cwd ${shellQuote(execution.cwd)}`,
    ` --evidence-class ${execution.evidenceClass}`,
    ` --expected-failure ${shellQuote(execution.expectedFailure)}`,
    ` --execution-timeout ${execution.timeoutMs}`,
    ` --execute ${shellQuote(JSON.stringify(execution.argv))}`
  ].join("");
  return `safeword review run ${kind}${contextOption}${executionOptions} -- ${quoted}`;
}

// src/review/contract.ts
var REVIEW_KINDS = new Set([
  "quality-review",
  "scenario-gate",
  "plan-implementation",
  "plan-execution",
  "executable-red"
]);
function isReviewKind(value) {
  return typeof value === "string" && REVIEW_KINDS.has(value);
}

// src/review/packet.ts
import { createHash, randomUUID } from "crypto";
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
  writeFileSync
} from "fs";
import { tmpdir } from "os";
import nodePath from "path";
var MAX_FILE_COUNT = 64;
var MAX_FILE_BYTES = 256 * 1024;
var MAX_PACKET_BYTES = 1024 * 1024;
var HIGH_CONFIDENCE_SECRET_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/u,
  /\bAKIA[0-9A-Z]{16}\b/u,
  /\bgh[pousr]_[A-Za-z0-9]{36,}\b/u,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/u,
  /\bsk-(?:proj-|ant-)[\w-]{16,}\b/u,
  /\bAIza[\w-]{35}\b/u
];

class ReviewPacketError extends Error {
  name = "ReviewPacketError";
}
function requireScenarioTicketSpec(kind, contextFiles) {
  if (kind !== "scenario-gate")
    return;
  const ticketSpec = contextFiles[0];
  if (ticketSpec === undefined || nodePath.basename(ticketSpec.path) !== "spec.md" || ticketSpec.content.trim() === "") {
    throw new ReviewPacketError("Scenario-gate review requires a non-blank spec.md as its first context file");
  }
}
function requirePlanWorkArtifact(kind, logicalFiles) {
  if (kind !== "plan-implementation")
    return;
  const plan = logicalFiles[0];
  if (logicalFiles.length !== 1 || plan === undefined || nodePath.basename(plan.path) !== "impl-plan.md" || plan.content.trim() === "") {
    throw new ReviewPacketError("Plan-implementation review requires one non-blank impl-plan.md work file; pass supporting evidence with --context");
  }
}
function requireExecutableRedAttestation(kind, attestation) {
  if (kind === "executable-red" && attestation === undefined) {
    throw new ReviewPacketError("Executable-red review requires a trusted execution attestation");
  }
  if (kind !== "executable-red" && attestation !== undefined) {
    throw new ReviewPacketError("Trusted execution attestations are accepted only for executable-red review");
  }
}
function checkedExecutionAttestation(kind, execution) {
  if (kind !== "executable-red" || execution.allowMissingExecutableRedAttestation !== true) {
    requireExecutableRedAttestation(kind, execution.attestation);
  }
  return execution.attestation;
}
function digest(content) {
  return createHash("sha256").update(content).digest("hex");
}
function fileDigest(path) {
  try {
    return digest(readFileSync(path));
  } catch {
    return;
  }
}
function sourceFileChanged(file) {
  let descriptor;
  try {
    descriptor = openSync(file.source, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const current = fstatSync(descriptor);
    return !current.isFile() || current.dev !== file.device || current.ino !== file.inode || digest(readFileSync(descriptor)) !== file.sha256;
  } catch {
    return true;
  } finally {
    if (descriptor !== undefined)
      closeSync(descriptor);
  }
}
function readContainedText(root, source, target, packetBytesRemaining) {
  const descriptor = openSync(source, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = fstatSync(descriptor);
    if (!opened.isFile())
      throw new Error(`Review target is not a regular file: ${target}`);
    if (opened.size > MAX_FILE_BYTES) {
      throw new Error(`Review target exceeds the ${MAX_FILE_BYTES}-byte limit: ${target}`);
    }
    if (opened.size > packetBytesRemaining) {
      throw new Error(`Review packet exceeds the ${MAX_PACKET_BYTES}-byte limit`);
    }
    const resolved = realpathSync(source);
    if (escapes(root, resolved))
      throw new Error(`Review target escapes the project: ${target}`);
    const observed = lstatSync(resolved);
    if (opened.dev !== observed.dev || opened.ino !== observed.ino) {
      throw new Error(`Review target changed while it was being captured: ${target}`);
    }
    const bytes = readFileSync(descriptor);
    let content;
    try {
      content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new Error(`Review target is not valid UTF-8 text: ${target}`);
    }
    if (HIGH_CONFIDENCE_SECRET_PATTERNS.some((pattern) => pattern.test(content))) {
      throw new Error(`Review packet rejected a high-confidence credential in ${target}; redact it before dispatch`);
    }
    return { bytes, content, device: opened.dev, inode: opened.ino };
  } finally {
    closeSync(descriptor);
  }
}
function escapes(root, candidate) {
  const relative = nodePath.relative(root, candidate);
  return relative === ".." || relative.startsWith(`..${nodePath.sep}`) || nodePath.isAbsolute(relative);
}
function snapshotEntries(root, directory = root) {
  return readdirSync(directory).flatMap((name) => {
    const path = nodePath.join(directory, name);
    const relative = nodePath.relative(root, path);
    const stats = lstatSync(path);
    if (stats.isDirectory())
      return [`directory:${relative}`, ...snapshotEntries(root, path)];
    if (stats.isFile())
      return [`file:${relative}`];
    return [`other:${relative}`];
  });
}
function prepareReviewPacketUnsafe(cwd, kind, targets, context = [], execution = {}) {
  if (targets.length + context.length > MAX_FILE_COUNT) {
    throw new Error(`Review packet exceeds the ${MAX_FILE_COUNT}-file limit`);
  }
  const executionAttestation = checkedExecutionAttestation(kind, execution);
  const canonicalRoot = realpathSync(cwd);
  const workspace = mkdtempSync(nodePath.join(tmpdir(), "safeword-review-"));
  const tracked = [];
  const expectedSnapshotEntries = new Set;
  let logicalFiles;
  let contextFiles;
  try {
    let packetBytes = 0;
    const captureFiles = (files) => files.map((target) => {
      const source = nodePath.resolve(canonicalRoot, target);
      const relative = nodePath.relative(canonicalRoot, source);
      if (escapes(canonicalRoot, source)) {
        throw new Error(`Review target escapes the project: ${target}`);
      }
      const stats = lstatSync(source);
      if (!stats.isFile()) {
        throw new Error(`Review target is not a regular file: ${target}`);
      }
      const { bytes, content, device, inode } = readContainedText(canonicalRoot, source, target, MAX_PACKET_BYTES - packetBytes);
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
      writeFileSync(snapshot, bytes, { mode: 384 });
      let parent = nodePath.dirname(relative);
      while (parent !== ".") {
        expectedSnapshotEntries.add(`directory:${parent}`);
        parent = nodePath.dirname(parent);
      }
      expectedSnapshotEntries.add(`file:${relative}`);
      tracked.push({ source, snapshot, sha256: digest(bytes), device, inode });
      return { path: relative, content };
    });
    const seen = new Set;
    const rejectDuplicate = (target) => {
      const relative = nodePath.relative(canonicalRoot, nodePath.resolve(canonicalRoot, target));
      if (seen.has(relative)) {
        throw new Error(`Review packet contains a duplicate file: ${target}`);
      }
      seen.add(relative);
    };
    for (const target of targets)
      rejectDuplicate(target);
    for (const target of context)
      rejectDuplicate(target);
    logicalFiles = captureFiles(targets);
    contextFiles = captureFiles(context);
    requireScenarioTicketSpec(kind, contextFiles);
    requirePlanWorkArtifact(kind, logicalFiles);
  } catch (error) {
    rmSync(workspace, { recursive: true, force: true });
    throw error;
  }
  const packet = {
    schema_version: 1,
    dispatch_id: randomUUID(),
    kind,
    logical_files: logicalFiles,
    ...contextFiles.length > 0 && { context_files: contextFiles },
    ...executionAttestation !== undefined && { execution_attestation: executionAttestation }
  };
  if (Buffer.byteLength(JSON.stringify(packet), "utf8") > MAX_PACKET_BYTES) {
    rmSync(workspace, { recursive: true, force: true });
    throw new ReviewPacketError(`Review packet exceeds the ${MAX_PACKET_BYTES}-byte limit`);
  }
  return {
    packet,
    sourceRoot: canonicalRoot,
    workspace,
    sourceChanged: () => tracked.some((file) => sourceFileChanged(file)),
    snapshotChanged: () => {
      if (tracked.some((file) => fileDigest(file.snapshot) !== file.sha256))
        return true;
      try {
        const actualEntries = snapshotEntries(workspace);
        return actualEntries.length !== expectedSnapshotEntries.size || actualEntries.some((entry) => !expectedSnapshotEntries.has(entry));
      } catch {
        return true;
      }
    },
    cleanup: () => {
      rmSync(workspace, { recursive: true, force: true });
    }
  };
}
function prepareReviewPacket(cwd, kind, targets, context = [], execution = {}) {
  try {
    return prepareReviewPacketUnsafe(cwd, kind, targets, context, execution);
  } catch (error) {
    if (error instanceof ReviewPacketError)
      throw error;
    const message = error instanceof Error ? error.message : "";
    throw new ReviewPacketError(message.startsWith("Review ") ? message : "Review packet could not be prepared. Check that every target and context path exists and is readable.");
  }
}

// src/review/runtime.ts
var REVIEW_OUTPUT_SCHEMA_SHAPE = {
  type: "object",
  properties: {
    schema_version: { type: "integer", enum: [1] },
    dispatch_id: { type: "string" },
    reviewer_agent: { type: "string", enum: ["claude", "codex", "opencode"] },
    verdict: { type: "string", enum: ["approve", "request_changes"] },
    summary: { type: "string" },
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          severity: { type: "string", enum: ["info", "warning", "error"] },
          message: { type: "string" }
        },
        required: ["severity", "message"],
        additionalProperties: false
      }
    }
  },
  required: ["schema_version", "dispatch_id", "reviewer_agent", "verdict", "summary", "findings"],
  additionalProperties: false
};
var REVIEW_OUTPUT_SCHEMA = JSON.stringify(REVIEW_OUTPUT_SCHEMA_SHAPE);
var CLAUDE_EFFORT_LEVELS = new Set(["low", "medium", "high", "xhigh", "max"]);
var MAX_OUTPUT_BYTES = 1024 * 1024;
var RUN_BOUND_MS = 270000;
var BACKGROUND_RUN_BOUND_MS = 1800000;
function reviewRunCeiling(env) {
  return env.SAFEWORD_REVIEW_WORKER === "1" ? BACKGROUND_RUN_BOUND_MS : RUN_BOUND_MS;
}
function runBoundMs(env = process.env) {
  const configured = Number(env.SAFEWORD_REVIEW_RUN_BOUND_MS);
  const ceiling = reviewRunCeiling(env);
  return Number.isFinite(configured) && configured > 0 ? Math.min(configured, ceiling) : ceiling;
}
function reviewWorkerRunBoundMs(env = process.env) {
  return runBoundMs({ ...env, SAFEWORD_REVIEW_WORKER: "1" });
}
var reviewerStops = new WeakMap;

// src/review/job.ts
var COURTESY_WAIT_MS = 75000;
var POLL_INTERVAL_MS = 100;
var WORKER_INSPECTION_INTERVAL_MS = 1000;
var JOB_LOCK_WAIT_MS = 2000;
function jobsDirectory(cwd) {
  return nodePath2.join(cwd, ".safeword", "state", "reviews");
}
function jobPath(cwd, id) {
  if (!isJobId(id))
    throw new Error("invalid review job id");
  return nodePath2.join(jobsDirectory(cwd), `${id}.json`);
}
function integrityKeyPath() {
  const testRoot = process.env.SAFEWORD_REVIEW_KEY_ROOT;
  const stateRoot = process.env.XDG_STATE_HOME ?? nodePath2.join(homedir(), ".local", "state");
  return nodePath2.join(stateRoot, "safeword", "review-integrity.key");
}
function readOrCreateIntegrityKey() {
  const keyPath = integrityKeyPath();
  try {
    return decodeIntegrityKey(readFileSync2(keyPath, "utf8"));
  } catch {
    mkdirSync2(nodePath2.dirname(keyPath), { recursive: true, mode: 448 });
    const key = randomBytes(32);
    try {
      const descriptor = openSync2(keyPath, "wx", 384);
      try {
        writeFileSync2(descriptor, `${key.toString("hex")}
`);
      } finally {
        closeSync2(descriptor);
      }
      return key;
    } catch (error) {
      if (!isFileExistsError(error))
        throw error;
      return decodeIntegrityKey(readFileSync2(keyPath, "utf8"));
    }
  }
}
function decodeIntegrityKey(value) {
  const encoded = value.trim();
  if (!/^[a-f\d]{64}$/u.test(encoded))
    throw new Error("invalid review integrity key");
  return Buffer.from(encoded, "hex");
}
function unsignedRecord(record) {
  const { integrity: _integrity, ...unsigned } = record;
  return unsigned;
}
function recordIntegrity(cwd, record) {
  return createHmac("sha256", readOrCreateIntegrityKey()).update(realpathSync2.native(cwd)).update("\x00").update(JSON.stringify(unsignedRecord(record))).digest("hex");
}
function hasValidIntegrity(cwd, record) {
  if (record.integrity === undefined || !/^[a-f\d]{64}$/u.test(record.integrity))
    return false;
  try {
    const actual = Buffer.from(record.integrity, "hex");
    const expected = Buffer.from(recordIntegrity(cwd, record), "hex");
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
function withRecordIntegrity(cwd, record) {
  const unsigned = { ...record, integrity: undefined };
  return { ...unsigned, integrity: recordIntegrity(cwd, unsigned) };
}
var DELIVERY_CHECKLIST_MARKER = "<!-- safeword:delivery-checklist:v1 -->";
var DELIVERY_CHECKLIST_COLUMNS = 9;
var ORDINARY_PROGRESS_DISPOSITIONS = new Set(["open", "complete"]);
function splitExecutionPlanRow(line) {
  if (!line.trimStart().startsWith("|") || !line.trimEnd().endsWith("|"))
    return;
  const cells = [];
  let cell = "";
  let escaped = false;
  const body = line.trim().slice(1, -1);
  for (const character of body) {
    if (escaped) {
      cell += character;
      escaped = false;
    } else if (character === "\\") {
      escaped = true;
    } else if (character === "|") {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += character;
    }
  }
  if (escaped)
    cell += "\\";
  cells.push(cell.trim());
  return cells;
}
function unescapedPipeOffsets(line) {
  const offsets = [];
  let escaped = false;
  let index = 0;
  while (index < line.length) {
    const character = line[index];
    if (escaped) {
      escaped = false;
    } else if (character === "\\") {
      escaped = true;
    } else if (character === "|") {
      offsets.push(index);
    }
    index += 1;
  }
  return offsets;
}
function normalizeExecutionPlanProgress(line) {
  const cells = splitExecutionPlanRow(line);
  if (cells?.length !== DELIVERY_CHECKLIST_COLUMNS || !ORDINARY_PROGRESS_DISPOSITIONS.has(cells[5] ?? "")) {
    return line;
  }
  const pipes = unescapedPipeOffsets(line);
  if (pipes.length !== DELIVERY_CHECKLIST_COLUMNS + 1)
    return line;
  const stableEnd = pipes[5];
  const finalPipe = pipes[9];
  if (stableEnd === undefined || finalPipe === undefined)
    return line;
  return `${line.slice(0, stableEnd + 1)} <progress> | <progress> | <progress> | <progress> ${line.slice(finalPipe)}`;
}
function hasExecutionPlanDeliveryChecklist(content) {
  return content.split(`
`).some((line) => line.trim() === DELIVERY_CHECKLIST_MARKER);
}
function normalizedExecutionPlanDigest(content) {
  const lines = content.split(`
`);
  const markerIndex = lines.findIndex((line) => line.trim() === DELIVERY_CHECKLIST_MARKER);
  if (markerIndex !== -1) {
    const headerIndex = lines.findIndex((line, index) => {
      if (index <= markerIndex)
        return false;
      const cells = splitExecutionPlanRow(line);
      return cells?.length === DELIVERY_CHECKLIST_COLUMNS && cells[0] === "ID" && cells[5] === "Disposition";
    });
    for (let index = headerIndex + 1;headerIndex !== -1 && index < lines.length; index += 1) {
      const line = lines[index];
      if (line === undefined || splitExecutionPlanRow(line)?.length !== DELIVERY_CHECKLIST_COLUMNS)
        break;
      lines[index] = normalizeExecutionPlanProgress(line);
    }
  }
  return createHash2("sha256").update(lines.join(`
`)).digest("hex");
}
function executionPlanReviewIdentity(content, projectDirectory) {
  const configPath = nodePath2.join(projectDirectory, ".safeword", "config.json");
  let designApprovalGate = false;
  if (existsSync(configPath)) {
    const value = JSON.parse(readFileSync2(configPath, "utf8"));
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error("Safeword config root is not an object");
    }
    designApprovalGate = value.designApprovalGate === true;
  }
  return JSON.stringify({
    design_approval_gate: designApprovalGate,
    normalized_digest: normalizedExecutionPlanDigest(content)
  });
}
function ledgerFingerprintContext(cwd, targets, context, execution) {
  if (execution === undefined)
    return { context, missing: false };
  const canonicalRoot = realpathSync2.native(cwd);
  const ledgerPath = nodePath2.resolve(canonicalRoot, execution.ledger);
  if (pathEscapes(canonicalRoot, ledgerPath)) {
    throw new Error(`Executable RED ledger escapes the project: ${execution.ledger}`);
  }
  const missing = !existsSync(ledgerPath);
  const included = [...targets, ...context].some((target) => nodePath2.resolve(canonicalRoot, target) === ledgerPath);
  return {
    context: included || missing ? context : [...context, execution.ledger],
    missing
  };
}
function fingerprint(cwd, kind, targets, context = [], execution) {
  const ledger = ledgerFingerprintContext(cwd, targets, context, execution);
  const prepared = prepareReviewPacket(cwd, kind, targets, ledger.context, {
    allowMissingExecutableRedAttestation: true
  });
  try {
    const hash = createHash2("sha256");
    hash.update(`kind\x00${kind}\x00`);
    if (execution !== undefined)
      hash.update(`execution\x00${JSON.stringify(execution)}\x00`);
    if (ledger.missing)
      hash.update("ledger\x00missing\x00");
    const executionPlanTarget = kind === "plan-execution" ? prepared.packet.logical_files.find((file) => hasExecutionPlanDeliveryChecklist(file.content)) : undefined;
    const executionPlanFingerprint = executionPlanTarget === undefined ? undefined : executionPlanReviewIdentity(executionPlanTarget.content, cwd);
    for (const [section, files] of [
      ["targets", prepared.packet.logical_files],
      ["context", prepared.packet.context_files ?? []]
    ]) {
      hash.update(`${section}\x00${files.length}\x00`);
      for (const file of files) {
        hash.update(file.path);
        hash.update("\x00");
        hash.update(reviewFingerprintContent(section, file.path, file.content, executionPlanTarget?.path, executionPlanFingerprint));
        hash.update("\x00");
      }
    }
    return hash.digest("hex");
  } finally {
    prepared.cleanup();
  }
}
function reviewFingerprintContent(section, path, content, executionPlanTargetPath, executionPlanFingerprint) {
  if (section === "targets" && path === executionPlanTargetPath && executionPlanFingerprint !== undefined) {
    return executionPlanFingerprint;
  }
  return content;
}
function pathEscapes(root, candidate) {
  const relative = nodePath2.relative(root, candidate);
  return relative === ".." || relative.startsWith(`..${nodePath2.sep}`) || nodePath2.isAbsolute(relative);
}
function writeJob(cwd, record) {
  const secured = withRecordIntegrity(cwd, record);
  if (!isReviewJobRecord(secured))
    throw new Error("invalid review job record");
  const directory = jobsDirectory(cwd);
  mkdirSync2(directory, { recursive: true, mode: 448 });
  const destination = jobPath(cwd, secured.id);
  const temporary = `${destination}.${process.pid}.tmp`;
  writeFileSync2(temporary, `${JSON.stringify(secured)}
`, { mode: 384 });
  renameSync(temporary, destination);
  return secured;
}
function withJobLock(cwd, id, operation) {
  return withFileLock(`${jobPath(cwd, id)}.lock`, operation);
}
function withFileLock(lock, operation) {
  const deadline = Date.now() + JOB_LOCK_WAIT_MS;
  let descriptor;
  while (descriptor === undefined) {
    try {
      descriptor = openSync2(lock, "wx", 384);
      try {
        writeFileSync2(descriptor, String(process.pid));
      } catch (error) {
        closeSync2(descriptor);
        descriptor = undefined;
        try {
          unlinkSync(lock);
        } catch {}
        throw error;
      }
    } catch (error) {
      if (!isFileExistsError(error) || Date.now() >= deadline)
        throw error;
      recoverStaleLock(lock);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }
  }
  try {
    return operation();
  } finally {
    const ownedLock = fstatSync2(descriptor);
    closeSync2(descriptor);
    try {
      const currentLock = statSync(lock);
      if (currentLock.dev === ownedLock.dev && currentLock.ino === ownedLock.ino)
        unlinkSync(lock);
    } catch {}
  }
}
function recoverStaleLock(lock) {
  try {
    const inspected = statSync(lock);
    const owner = Number(readFileSync2(lock, "utf8"));
    const invalidOwnerIsOld = !isProcessId(owner) && Date.now() - statSync(lock).mtimeMs >= JOB_LOCK_WAIT_MS;
    if (isProcessId(owner) && !processExists(owner) || invalidOwnerIsOld) {
      const current = statSync(lock);
      if (current.dev === inspected.dev && current.ino === inspected.ino)
        unlinkSync(lock);
    }
  } catch {}
}
function isFileExistsError(error) {
  return error instanceof Error && "code" in error && error.code === "EEXIST";
}
function updateActiveJob(cwd, id, update) {
  return withJobLock(cwd, id, () => {
    const latest = readJob(cwd, id);
    if (latest.state !== "launching" && latest.state !== "running")
      return latest;
    const next = update(latest);
    return writeJob(cwd, next);
  });
}
function isReviewJobRecord(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const candidate = value;
  return hasReviewJobIdentity(candidate) && hasReviewJobLifecycle(candidate);
}
function hasReviewJobIdentity(candidate) {
  const hasStrings = ["id", "source_fingerprint", "started_at", "updated_at"].every((key) => typeof candidate[key] === "string");
  return candidate.schema_version === 1 && hasStrings && isStringArray(candidate.targets) && isOptional(candidate.context, isStringArray) && (candidate.kind === "executable-red" ? isRedExecutionRequest(candidate.execution) : candidate.execution === undefined) && isOptional(candidate.deadline_at, (value) => typeof value === "string" && Number.isFinite(Date.parse(value))) && isReviewKind(candidate.kind);
}
function isRedExecutionRequest(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const candidate = value;
  return ["scenario", "ledger", "cwd", "expectedFailure"].every((key) => typeof candidate[key] === "string" && candidate[key].length > 0) && Array.isArray(candidate.argv) && candidate.argv.length > 0 && candidate.argv.every((argument) => typeof argument === "string") && ["pure-contract", "simulated-host", "local-live-host", "external-live-host"].includes(candidate.evidenceClass) && Number.isSafeInteger(candidate.timeoutMs) && candidate.timeoutMs > 0;
}
function hasReviewJobLifecycle(candidate) {
  if (!isJobState(candidate.state))
    return false;
  switch (candidate.state) {
    case "launching":
    case "running": {
      return isProcessId(candidate.pid) && candidate.result === undefined;
    }
    case "completed": {
      return isCoherentTerminalResult(candidate, false);
    }
    case "failed": {
      return isCoherentTerminalResult(candidate, true);
    }
    case "canceled": {
      return candidate.result === undefined;
    }
  }
}
function isCoherentTerminalResult(candidate, failed) {
  return isCliResult(candidate.result) && candidate.result.state === "failed" === failed && typeof candidate.integrity === "string";
}
function isOptional(value, predicate) {
  return value === undefined || predicate(value);
}
function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
function isProcessId(value) {
  return Number.isSafeInteger(value) && Number(value) > 1;
}
function isJobState(value) {
  return ["launching", "running", "completed", "failed", "canceled"].includes(String(value));
}
function isCliResult(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const candidate = value;
  const state = candidate.state;
  const effects = candidate.effects;
  const data = candidate.data;
  const expectedOk = state !== "failed";
  const expectedChanged = state === "changed";
  const hasHeader = candidate.schemaVersion === 1 && candidate.ok === expectedOk && candidate.changed === expectedChanged;
  const hasState = ["healthy", "changed", "action_required", "failed"].includes(String(state));
  const hasArrays = ["findings", "errors", "recovery", "nextActions"].every((key) => Array.isArray(candidate[key]));
  return hasHeader && hasState && hasArrays && isEffects(effects) && isReviewResultData(data, state);
}
function isEffects(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  return ["files", "packages", "configuration", "network", "destructive"].every((key) => Array.isArray(value[key]));
}
function isReviewResultData(value, state) {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const data = value;
  if (!["review run", "review status"].includes(String(data.command)))
    return false;
  if (typeof data.status !== "string")
    return false;
  if (data.command === "review status")
    return ["failed", "stale"].includes(data.status);
  if (data.status !== "approved" && data.status !== "changes_requested")
    return ["blocked", "existing_route", "failed", "stale"].includes(data.status);
  return isCompletedReviewData(data, state);
}
function isCompletedReviewData(data, state) {
  const output = data.reviewer_output;
  if (typeof output !== "object" || output === null || Array.isArray(output))
    return false;
  const reviewer = output;
  const verdict = data.status === "approved" ? "approve" : "request_changes";
  return hasReviewerIdentity(reviewer) && reviewer.verdict === verdict && typeof reviewer.summary === "string" && Array.isArray(reviewer.findings) && state === (data.status === "approved" ? "healthy" : "action_required");
}
function hasReviewerIdentity(reviewer) {
  return typeof reviewer.dispatch_id === "string" && reviewer.dispatch_id.length > 0 && ["claude", "codex", "opencode"].includes(String(reviewer.reviewer_agent));
}
function readJob(cwd, id) {
  const parsed = JSON.parse(readFileSync2(jobPath(cwd, id), "utf8"));
  if (!isReviewJobRecord(parsed) || parsed.id !== id || !hasValidIntegrity(cwd, parsed))
    throw new Error("invalid review job record");
  return parsed;
}
function pendingResult(record) {
  return createResult({
    state: "action_required",
    findings: [
      {
        code: "REVIEW_PENDING",
        message: "The independent review is still working in the background. Collect its result when it finishes.",
        severity: "info"
      }
    ],
    nextActions: [
      {
        command: reviewStatusCommand(record.id),
        mutates: false,
        requiresHuman: false
      }
    ],
    data: {
      command: "review run",
      status: "pending",
      review_id: record.id,
      started_at: record.started_at
    }
  });
}
function shellQuote2(value) {
  if (/^[\w./-]+$/u.test(value))
    return value;
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}
function reviewStatusCommand(id) {
  return `${shellQuote2(process.execPath)} ${shellQuote2(cliEntrypoint())} review status ${id}`;
}
function staleResult(record) {
  return createResult({
    state: "action_required",
    findings: [
      {
        code: "REVIEW_STALE",
        message: "The reviewed source changed after this review started; run a fresh review.",
        severity: "warning"
      }
    ],
    nextActions: [
      {
        command: retryCommand(record.kind, record.targets, record.context, record.execution),
        mutates: true,
        requiresHuman: false
      }
    ],
    data: { command: "review status", status: "stale", review_id: record.id }
  });
}
function currentResult(cwd, record) {
  if (isActiveJobPastDeadline(record))
    return failTimedOutJob(cwd, record);
  if (record.state === "launching") {
    if (record.pid !== undefined && processExists(record.pid))
      return pendingResult(record);
    return failExitedJob(cwd, record);
  }
  if (record.state === "running") {
    if (workerDefinitelyMismatches(record)) {
      return failExitedJob(cwd, record);
    }
    return pendingResult(record);
  }
  return terminalResult(cwd, record);
}
function isActiveJobPastDeadline(record) {
  if (record.state !== "launching" && record.state !== "running")
    return false;
  const deadline = record.deadline_at === undefined ? NaN : Date.parse(record.deadline_at);
  return Number.isFinite(deadline) && Date.now() >= deadline;
}
function failActiveJob(cwd, record, error) {
  const failed = createResult({
    state: "failed",
    errors: [{ code: error.code, message: error.message, retryable: true }],
    data: { command: "review status", status: "failed", review_id: record.id }
  });
  const latest = updateActiveJob(cwd, record.id, (current) => ({
    ...current,
    state: "failed",
    result: failed,
    updated_at: new Date().toISOString()
  }));
  return latest.state === "failed" && latest.result === failed ? failed : terminalResult(cwd, latest);
}
function failTimedOutJob(cwd, record) {
  if (record.pid !== undefined && inspectReviewWorker(record.pid, record.id) === "match") {
    terminateReviewWorker(record.pid);
  }
  return failActiveJob(cwd, record, {
    code: "REVIEW_WORKER_TIMED_OUT",
    message: "The background review worker exceeded its deadline before recording a result."
  });
}
function failExitedJob(cwd, record) {
  return failActiveJob(cwd, record, {
    code: "REVIEW_WORKER_EXITED",
    message: "The background review worker exited before recording a result."
  });
}
function terminalResult(cwd, record) {
  if (!hasValidIntegrity(cwd, record))
    return invalidJobResult(record.id);
  if (record.state === "canceled") {
    return createResult({
      state: "action_required",
      findings: [
        { code: "REVIEW_CANCELED", message: "The review was canceled.", severity: "warning" }
      ],
      data: { command: "review status", status: "canceled", review_id: record.id }
    });
  }
  try {
    if (fingerprint(cwd, record.kind, record.targets, record.context, record.execution) !== record.source_fingerprint)
      return staleResult(record);
  } catch {
    return staleResult(record);
  }
  if (record.result !== undefined)
    return withReviewProvenance(record, record.result);
  return createResult({
    state: "failed",
    errors: [
      { code: "REVIEW_JOB_INVALID", message: "The review job has no result.", retryable: true }
    ],
    data: { command: "review status", status: "failed", review_id: record.id }
  });
}
function withReviewProvenance(record, result) {
  const data = typeof result.data === "object" && result.data !== null && !Array.isArray(result.data) ? result.data : {};
  return {
    ...result,
    data: {
      ...data,
      review_id: record.id,
      review_kind: record.kind,
      review_targets: record.targets
    }
  };
}
function invalidJobResult(id) {
  return createResult({
    state: "failed",
    errors: [
      {
        code: "REVIEW_JOB_INVALID",
        message: "The review job could not be verified as Safeword-produced.",
        retryable: true
      }
    ],
    data: { command: "review status", status: "failed", review_id: id }
  });
}
function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error instanceof Error && "code" in error && error.code === "EPERM";
  }
}
function processTool(name) {
  const [baseName] = name.split(".", 1);
  const testOverride = process.env[`SAFEWORD_REVIEW_${baseName?.toUpperCase()}_PATH`];
  if (false)
    ;
  if (process.platform !== "win32")
    return `/bin/${name}`;
  const systemRoot = process.env.SystemRoot ?? String.raw`C:\Windows`;
  return name === "powershell.exe" ? nodePath2.join(systemRoot, "System32", "WindowsPowerShell", "v1.0", name) : nodePath2.join(systemRoot, "System32", name);
}
function configuredCourtesyWait() {
  const raw = process.env.SAFEWORD_REVIEW_FOREGROUND_MS;
  const value = raw === undefined || raw.trim() === "" ? NaN : Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.min(value, 540000) : COURTESY_WAIT_MS;
}
function cliEntrypoint() {
  const configured = process.env.SAFEWORD_CLI_ENTRYPOINT;
  if (configured !== undefined && false)
    ;
  const invoked = process.argv[1];
  if (invoked !== undefined && /^cli\.(?:js|ts)$/u.test(nodePath2.basename(invoked)))
    return invoked;
  const bundled = nodePath2.join(import.meta.dirname, "cli.js");
  if (existsSync(bundled))
    return bundled;
  const developmentBuild = nodePath2.resolve(import.meta.dirname, "../../dist/cli.js");
  if (existsSync(developmentBuild))
    return developmentBuild;
  throw new Error("Safeword CLI entrypoint is unavailable");
}
function launchReviewWorker(input) {
  return spawn(process.execPath, [
    input.entrypoint,
    "review",
    "run",
    input.kind,
    ...input.managedProgress ? ["--json"] : [],
    "--worker-job-id",
    input.id,
    ...input.context.flatMap((target) => ["--context", target]),
    "--",
    ...input.targets
  ], {
    cwd: input.cwd,
    env: {
      ...process.env,
      SAFEWORD_REVIEW_JOB_ID: input.id,
      SAFEWORD_REVIEW_WORKER: "1",
      ...input.managedProgress && { SAFEWORD_REVIEW_PROGRESS: "1" }
    },
    detached: true,
    stdio: input.managedProgress ? ["ignore", "ignore", "pipe"] : "ignore"
  });
}
function closeNoManagedProgress() {
  return;
}
function containManagedRelayError() {}
function relayManagedWorkerStderr(child, enabled) {
  const stderr = child.stderr;
  if (!enabled || stderr === null)
    return closeNoManagedProgress;
  const writeBytes = createBestEffortByteSink((buffer, offset, length) => writeSync(2, buffer, offset, length));
  const forward = (chunk) => {
    writeBytes(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  };
  stderr.on("data", forward);
  stderr.on("error", containManagedRelayError);
  return () => {
    stderr.off("data", forward);
    stderr.once("close", () => stderr.off("error", containManagedRelayError));
    stderr.destroy();
  };
}
function workerLaunchSettled(child) {
  return new Promise((resolve) => {
    child.once("spawn", resolve);
    child.once("error", resolve);
  });
}
function announceBackgroundProgress(progress, managedProgress) {
  if (managedProgress)
    return;
  progress?.start("Running the independent review in the background\u2026");
  progress?.heartbeat?.("Still waiting for the independent review\u2026");
}
async function startReviewJob(input) {
  const context = input.context ?? [];
  const sourceFingerprint = fingerprint(input.cwd, input.kind, input.targets, context, input.execution);
  mkdirSync2(jobsDirectory(input.cwd), { recursive: true, mode: 448 });
  const reserved = withFileLock(nodePath2.join(jobsDirectory(input.cwd), "start.lock"), () => {
    const existing = runningJob(input.cwd, input.kind, sourceFingerprint) ?? (input.kind === "executable-red" ? reusableApprovedExecutableRedJob(input.cwd, sourceFingerprint) : undefined);
    if (existing !== undefined)
      return { existing: true, record: existing };
    const now = new Date().toISOString();
    const record2 = {
      schema_version: 1,
      id: randomUUID2(),
      state: "launching",
      kind: input.kind,
      targets: input.targets,
      context,
      execution: input.execution,
      source_fingerprint: sourceFingerprint,
      started_at: now,
      updated_at: now,
      deadline_at: new Date(Date.now() + reviewWorkerRunBoundMs()).toISOString(),
      pid: process.pid
    };
    writeJob(input.cwd, record2);
    return { existing: false, record: record2 };
  });
  if (reserved.existing)
    return currentResult(input.cwd, reserved.record);
  const record = reserved.record;
  const id = record.id;
  const entrypoint = cliEntrypoint();
  const managedProgress = input.progress?.managed === true;
  const child = launchReviewWorker({
    context,
    cwd: input.cwd,
    entrypoint,
    id,
    kind: input.kind,
    managedProgress,
    targets: input.targets
  });
  const closeManagedProgress = relayManagedWorkerStderr(child, managedProgress);
  const launchSettled = workerLaunchSettled(child);
  child.once("error", (error) => {
    const failed = createResult({
      state: "failed",
      errors: [
        {
          code: "REVIEW_WORKER_START_FAILED",
          message: `The background review worker could not start: ${error.message}`,
          retryable: true
        }
      ],
      data: { command: "review run", status: "failed", review_id: id }
    });
    try {
      updateActiveJob(input.cwd, id, (latest) => ({
        ...latest,
        state: "failed",
        result: failed,
        updated_at: new Date().toISOString()
      }));
    } catch {}
  });
  child.unref();
  try {
    if (child.pid === undefined) {
      const failed = createResult({
        state: "failed",
        errors: [
          {
            code: "REVIEW_WORKER_START_FAILED",
            message: "The background review worker could not be started.",
            retryable: true
          }
        ],
        data: { command: "review run", status: "failed", review_id: id }
      });
      writeJob(input.cwd, {
        ...record,
        state: "failed",
        result: failed,
        updated_at: new Date().toISOString()
      });
      return failed;
    }
    updateActiveJob(input.cwd, id, (current) => ({
      ...current,
      state: "running",
      pid: child.pid,
      updated_at: new Date().toISOString()
    }));
    await launchSettled;
    const observed = readJob(input.cwd, id);
    if (!isActivatedChild(observed, child.pid)) {
      terminateUnactivatedWorker(observed, child.pid);
      return currentResult(input.cwd, observed);
    }
    announceBackgroundProgress(input.progress, managedProgress);
    const deadline = Date.now() + configuredCourtesyWait();
    let nextInspectionAt = 0;
    while (Date.now() < deadline) {
      const latest = readJob(input.cwd, id);
      if (latest.state !== "running")
        return currentResult(input.cwd, latest);
      const now = Date.now();
      if (now >= nextInspectionAt) {
        if (workerDefinitelyMismatches(latest))
          return failExitedJob(input.cwd, latest);
        nextInspectionAt = now + WORKER_INSPECTION_INTERVAL_MS;
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
    return currentResult(input.cwd, readJob(input.cwd, id));
  } finally {
    closeManagedProgress();
  }
}
function isActivatedChild(record, pid) {
  return record.state === "running" && record.pid === pid;
}
function workerDefinitelyMismatches(record) {
  return record.pid !== undefined && inspectReviewWorker(record.pid, record.id) === "mismatch";
}
function terminateUnactivatedWorker(record, pid) {
  if (record.state !== "completed" && record.state !== "failed" && inspectReviewWorker(pid, record.id) === "match")
    terminateReviewWorker(pid);
}
function terminateReviewWorker(pid) {
  if (process.platform === "win32") {
    spawnSync(processTool("taskkill"), ["/PID", String(pid), "/T", "/F"], {
      stdio: "ignore",
      timeout: 5000,
      windowsHide: true
    });
    return;
  }
  try {
    process.kill(-pid, "SIGTERM");
  } catch {}
}
function latestJobId(cwd) {
  const directory = jobsDirectory(cwd);
  if (!existsSync(directory))
    return;
  return readdirSync2(directory).flatMap((name) => {
    if (!/^[a-f\d-]{36}\.json$/u.test(name))
      return [];
    try {
      return [{ record: readJob(cwd, name.slice(0, -5)) }];
    } catch {
      return [];
    }
  }).toSorted((left, right) => right.record.started_at < left.record.started_at ? -1 : Number(right.record.started_at > left.record.started_at))[0]?.record.id;
}
function runningJob(cwd, kind, sourceFingerprint) {
  const directory = jobsDirectory(cwd);
  if (!existsSync(directory))
    return;
  for (const name of readdirSync2(directory)) {
    if (!/^[a-f\d-]{36}\.json$/u.test(name))
      continue;
    try {
      const record = readJob(cwd, name.slice(0, -5));
      if (isActiveReviewJob(record) && record.kind === kind && record.source_fingerprint === sourceFingerprint) {
        return record;
      }
    } catch {}
  }
  return;
}
function reusableApprovedExecutableRedJob(cwd, sourceFingerprint) {
  const directory = jobsDirectory(cwd);
  if (!existsSync(directory))
    return;
  for (const name of readdirSync2(directory)) {
    if (!/^[a-f\d-]{36}\.json$/u.test(name))
      continue;
    try {
      const record = readJob(cwd, name.slice(0, -5));
      if (record.kind === "executable-red" && record.source_fingerprint === sourceFingerprint && approvedCrossAgentReceipt(record))
        return record;
    } catch {}
  }
  return;
}
function hasIndependentApproval(data) {
  const reviewerOutput = data?.reviewer_output;
  const actualReviewer = data?.actual_reviewer;
  return [
    data?.status === "approved",
    data?.independence === "cross-agent",
    typeof data?.author_agent === "string",
    ["claude", "codex", "opencode"].includes(actualReviewer),
    data?.author_agent !== actualReviewer,
    reviewerOutput?.reviewer_agent === actualReviewer
  ].every(Boolean);
}
function hasFailingExecutionAttestation(attestation, sourceFingerprint) {
  const expectedFailure = attestation?.expected_failure;
  const termination = attestation?.termination;
  return [
    attestation?.source_fingerprint === sourceFingerprint,
    expectedFailure?.matched === true,
    typeof termination?.exit_code === "number",
    termination?.exit_code !== 0,
    termination?.timed_out === false
  ].every(Boolean);
}
function approvedCrossAgentReceipt(record) {
  const data = record.result?.data;
  const attestation = data?.execution_attestation;
  return record.state === "completed" && (record.pid === undefined || inspectReviewWorker(record.pid, record.id) !== "match") && hasIndependentApproval(data) && hasFailingExecutionAttestation(attestation, record.source_fingerprint);
}
function isActiveReviewJob(record) {
  if (record.pid === undefined)
    return false;
  if (record.state === "launching")
    return processExists(record.pid);
  return record.state === "running" && inspectReviewWorker(record.pid, record.id) !== "mismatch";
}
function reviewJobStatus(cwd, requestedId) {
  let id;
  try {
    id = requestedId ?? latestJobId(cwd);
  } catch {
    id = requestedId;
  }
  if (id === undefined) {
    return createResult({
      state: "failed",
      errors: [
        { code: "REVIEW_JOB_NOT_FOUND", message: "No review job was found.", retryable: false }
      ],
      data: { command: "review status" }
    });
  }
  let record;
  try {
    record = readJob(cwd, id);
  } catch {
    const exists = isJobId(id) && existsSync(jobPath(cwd, id));
    return createResult({
      state: "failed",
      errors: [
        {
          code: exists ? "REVIEW_JOB_INVALID" : "REVIEW_JOB_NOT_FOUND",
          message: exists ? `Review job ${id} is invalid.` : `Review job ${id} was not found.`,
          retryable: false
        }
      ],
      data: { command: "review status", review_id: id }
    });
  }
  try {
    const result = currentResult(cwd, record);
    return { ...result, effects: { ...result.effects, network: [] } };
  } catch {
    return createResult({
      state: "action_required",
      findings: [
        {
          code: "REVIEW_STATUS_FAILED",
          message: "The review exists, but its current status could not be validated or saved.",
          severity: "warning"
        }
      ],
      data: { command: "review status", status: "blocked", review_id: id }
    });
  }
}
function isJobId(value) {
  return /^[a-f\d-]{36}$/u.test(value);
}
function inspectReviewWorker(pid, id) {
  const inspected = process.platform === "win32" ? spawnSync(processTool("powershell.exe"), [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    `(Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}").CommandLine`
  ], { encoding: "utf8", timeout: 1000, windowsHide: true }) : spawnSync(processTool("ps"), ["-ww", "-p", String(pid), "-o", "command="], {
    encoding: "utf8",
    timeout: 1000
  });
  if (inspected.status !== 0)
    return processExists(pid) ? "unavailable" : "mismatch";
  return /\breview run\b/u.test(inspected.stdout) && inspected.stdout.includes(`--worker-job-id ${id}`) ? "match" : "mismatch";
}

// src/codex-plugin/review-mcp.ts
var REVIEW_KINDS2 = new Set([
  "quality-review",
  "scenario-gate",
  "plan-implementation"
]);
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function paths(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim() === "" || nodePath3.isAbsolute(item) || item.split(/[\\/]/u).includes(".."))) {
    throw new Error(`${label} must contain project-relative file paths`);
  }
  return value;
}
function textResult(value, isError = false) {
  return { content: [{ type: "text", text: JSON.stringify(value) }], ...isError && { isError } };
}
function reviewInput(args) {
  if (!isRecord(args))
    throw new Error("Review arguments must be an object");
  const { project_root: projectRoot, kind } = args;
  if (typeof projectRoot !== "string" || !nodePath3.isAbsolute(projectRoot)) {
    throw new Error("project_root must be an absolute directory path");
  }
  if (typeof kind !== "string" || !REVIEW_KINDS2.has(kind)) {
    throw new Error("kind must be quality-review, scenario-gate, or plan-implementation");
  }
  const targets = paths(args.targets, "targets");
  const context = paths(args.context ?? [], "context");
  if (targets.length === 0 || targets.length + context.length > 64) {
    throw new Error("Reviews require 1\u201364 total files");
  }
  const cwd = realpathSync3(projectRoot);
  if (!statSync2(cwd).isDirectory())
    throw new Error("project_root must be a directory");
  return { cwd, kind, targets, context };
}
async function startReview(args) {
  const input = reviewInput(args);
  const result = await startReviewJob({ ...input, progress: undefined });
  return textResult(result);
}
function reviewStatus(args) {
  if (!isRecord(args) || typeof args.review_id !== "string" || typeof args.project_root !== "string" || !nodePath3.isAbsolute(args.project_root)) {
    throw new Error("review_id and absolute project_root are required");
  }
  const result = reviewJobStatus(realpathSync3(args.project_root), args.review_id);
  const data = result.data;
  const independent = isRecord(data) && data.independence === "cross-agent" && (data.status === "approved" || data.status === "changes_requested");
  return textResult({
    review_id: args.review_id,
    status: isRecord(data) && typeof data.status === "string" ? data.status : result.state,
    independent,
    result
  });
}
var tools = [
  {
    name: "start_review",
    description: "Start an independent Safeword review of bounded project files. It sends a bounded packet to the configured reviewer and stores a signed receipt under .safeword/state/reviews for workflow verification. Poll review_status until terminal.",
    annotations: { readOnlyHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        project_root: { type: "string", description: "Absolute project directory" },
        kind: { type: "string", enum: [...REVIEW_KINDS2] },
        targets: { type: "array", items: { type: "string" }, minItems: 1 },
        context: { type: "array", items: { type: "string" } }
      },
      required: ["project_root", "kind", "targets"]
    }
  },
  {
    name: "review_status",
    description: "Get a review result and recheck its signed receipt and source freshness.",
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        project_root: { type: "string", description: "Absolute project directory" },
        review_id: { type: "string" }
      },
      required: ["project_root", "review_id"]
    }
  }
];
async function callTool(name, args) {
  if (name === "start_review")
    return startReview(args);
  if (name === "review_status")
    return reviewStatus(args);
  return textResult({ error: "Unknown tool" }, true);
}
async function handleReviewMcpRequest(request) {
  if (!isRecord(request) || !("id" in request))
    return;
  const id = request.id;
  const method = request.method;
  let result;
  try {
    if (method === "initialize") {
      result = {
        protocolVersion: "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "safeword-review", version: "1" }
      };
    } else if (method === "tools/list") {
      result = { tools };
    } else if (method === "tools/call" && isRecord(request.params)) {
      const { name, arguments: args } = request.params;
      result = await callTool(name, args);
    } else {
      return { jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } };
    }
  } catch (error) {
    result = textResult({ error: error instanceof Error ? error.message : String(error) }, true);
  }
  return { jsonrpc: "2.0", id, result };
}
if (import.meta.main) {
  process.env.SAFEWORD_AGENT_RUNTIME = "codex";
  process.env.SAFEWORD_REVIEW_FOREGROUND_MS = "0";
  const input = readline.createInterface({ input: process.stdin });
  for await (const line of input) {
    let request;
    try {
      request = JSON.parse(line);
    } catch {
      continue;
    }
    const response = await handleReviewMcpRequest(request);
    if (response !== undefined)
      process.stdout.write(`${JSON.stringify(response)}
`);
  }
}
export {
  handleReviewMcpRequest
};
