var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// cli-protocol/policy.ts
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
    } catch {
    }
  };
}
var init_policy = __esm({
  "cli-protocol/policy.ts"() {
    "use strict";
  }
});

// cli-protocol/review-presentation.ts
var init_review_presentation = __esm({
  "cli-protocol/review-presentation.ts"() {
    "use strict";
  }
});

// cli-protocol/result.ts
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
    ...input.exitCode !== void 0 && { exitCode: input.exitCode },
    ...input.presentation !== void 0 && { presentation: input.presentation },
    ...input.data !== void 0 && { data: input.data }
  };
}
var EMPTY_EFFECTS;
var init_result = __esm({
  "cli-protocol/result.ts"() {
    "use strict";
    init_review_presentation();
    EMPTY_EFFECTS = {
      files: [],
      packages: [],
      configuration: [],
      network: [],
      destructive: []
    };
  }
});

// review/command.ts
function shellQuote(value) {
  if (/^[\w./-]+$/u.test(value)) return value;
  const escaped = value.replaceAll("'", `'"'"'`);
  return `'${escaped}'`;
}
function contextArgument(target) {
  return `--context ${shellQuote(target)}`;
}
function retryCommand(kind, targets, context = [], execution) {
  const quoted = targets.map((target) => shellQuote(target)).join(" ");
  const contextOption = context.length === 0 ? "" : ` ${context.map((target) => contextArgument(target)).join(" ")}`;
  const executionOptions = execution === void 0 ? "" : [
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
var init_command = __esm({
  "review/command.ts"() {
    "use strict";
  }
});

// review/contract.ts
function isReviewKind(value) {
  return typeof value === "string" && REVIEW_KINDS.has(value);
}
var REVIEW_KINDS;
var init_contract = __esm({
  "review/contract.ts"() {
    "use strict";
    REVIEW_KINDS = /* @__PURE__ */ new Set([
      "quality-review",
      "scenario-gate",
      "plan-implementation",
      "plan-execution",
      "executable-red",
      "retrospective-eligibility",
      "retrospective-proof"
    ]);
  }
});

// review/environment.ts
function filteredEnvironment(reviewer, source = process.env, platform = process.platform) {
  const normalize = (name) => platform === "win32" ? name.toUpperCase() : name;
  const allowed = new Set(
    [
      ...PROCESS_VARIABLES,
      ...REVIEWER_CONTROL_VARIABLES,
      ...process.env.NODE_ENV === "test" ? REVIEWER_FIXTURE_VARIABLES : [],
      ...reviewer === void 0 ? [] : VENDOR_VARIABLES[reviewer]
    ].map((name) => normalize(name))
  );
  const managedProgressSignal = normalize("SAFEWORD_REVIEW_PROGRESS");
  return Object.fromEntries(
    Object.entries(source).filter(
      ([name]) => normalize(name) !== managedProgressSignal && allowed.has(normalize(name))
    )
  );
}
function reviewerEnvironment(reviewer, source = process.env, platform = process.platform) {
  const environment = filteredEnvironment(reviewer, source, platform);
  if (reviewer === "claude") {
    return { ...environment, CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1" };
  }
  if (reviewer !== "opencode") return environment;
  let inlineConfig = {};
  try {
    const parsed = JSON.parse(environment.OPENCODE_CONFIG_CONTENT ?? "{}");
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      inlineConfig = parsed;
    }
  } catch {
  }
  return {
    ...environment,
    OPENCODE_CONFIG_CONTENT: JSON.stringify({ ...inlineConfig, permission: { "*": "deny" } }),
    OPENCODE_DISABLE_AUTOUPDATE: "true",
    OPENCODE_DISABLE_DEFAULT_PLUGINS: "true",
    OPENCODE_DISABLE_LSP_DOWNLOAD: "true"
  };
}
var VENDOR_VARIABLES, PROCESS_VARIABLES, REVIEWER_CONTROL_VARIABLES, REVIEWER_FIXTURE_VARIABLES;
var init_environment = __esm({
  "review/environment.ts"() {
    "use strict";
    VENDOR_VARIABLES = {
      claude: [
        "ANTHROPIC_API_KEY",
        "CLAUDE_CODE_OAUTH_TOKEN",
        "CLAUDE_CONFIG_DIR",
        "CLAUDE_SESSION_ID",
        "CLAUDE_CODE_SESSION_ID"
      ],
      codex: [
        "OPENAI_API_KEY",
        "AZURE_OPENAI_API_KEY",
        "CODEX_API_KEY",
        "CODEX_HOME",
        "CODEX_THREAD_ID"
      ],
      opencode: [
        "ANTHROPIC_API_KEY",
        "OPENAI_API_KEY",
        "AZURE_OPENAI_API_KEY",
        "OPENCODE_CONFIG",
        "OPENCODE_CONFIG_CONTENT",
        "OPENCODE_CONFIG_DIR"
      ]
    };
    PROCESS_VARIABLES = [
      "ALL_PROXY",
      "APPDATA",
      "HOME",
      "HTTP_PROXY",
      "HTTPS_PROXY",
      "LANG",
      "LC_ALL",
      "LOGNAME",
      "LOCALAPPDATA",
      "NODE_EXTRA_CA_CERTS",
      "NO_PROXY",
      "PATH",
      "PATHEXT",
      "SHELL",
      "SYSTEMROOT",
      "SSL_CERT_DIR",
      "SSL_CERT_FILE",
      "TEMP",
      "TERM",
      "TMP",
      "TMPDIR",
      "USER",
      "USERPROFILE",
      "COMSPEC",
      "XDG_CACHE_HOME",
      "XDG_CONFIG_HOME",
      "all_proxy",
      "http_proxy",
      "https_proxy",
      "no_proxy"
    ];
    REVIEWER_CONTROL_VARIABLES = [
      "SAFEWORD_REVIEW_RUN_BOUND_MS",
      "SAFEWORD_REVIEW_TIMEOUT_MS"
    ];
    REVIEWER_FIXTURE_VARIABLES = [
      "SAFEWORD_REVIEW_ACCEPTED_MODEL",
      "SAFEWORD_REVIEW_BDD_EXPECTED_MODEL",
      "SAFEWORD_REVIEW_CANDIDATE_LOG",
      "SAFEWORD_REVIEW_CHILD_PID",
      "SAFEWORD_REVIEW_COVERAGE_FAIL",
      "SAFEWORD_REVIEW_COVERAGE_FAIL_CLAUDE",
      "SAFEWORD_REVIEW_COVERAGE_FAIL_CODEX",
      "SAFEWORD_REVIEW_COVERAGE_FINDING",
      "SAFEWORD_REVIEW_COVERAGE_VERDICT",
      "SAFEWORD_REVIEW_DESCENDANT_PID_FILE",
      "SAFEWORD_REVIEW_ENV_LOG",
      "SAFEWORD_REVIEW_FAKE_DELAY_AGENT",
      "SAFEWORD_REVIEW_FAKE_FAILURE",
      "SAFEWORD_REVIEW_FAKE_FAILURE_AGENT",
      "SAFEWORD_REVIEW_FAKE_FAILURE_CLAUDE",
      "SAFEWORD_REVIEW_FAKE_FAILURE_CODEX",
      "SAFEWORD_REVIEW_FAKE_FAILURE_OPENCODE",
      "SAFEWORD_REVIEW_FAKE_FAIL_PATH_CONTAINS",
      "SAFEWORD_REVIEW_FAKE_FINDING",
      "SAFEWORD_REVIEW_FAKE_HELP_FAILURE",
      "SAFEWORD_REVIEW_FAKE_IDENTITY",
      "SAFEWORD_REVIEW_FAKE_MODEL_CAPABILITY",
      "SAFEWORD_REVIEW_FAKE_MUTATE",
      "SAFEWORD_REVIEW_FAKE_MUTATE_AGENT",
      "SAFEWORD_REVIEW_FAKE_SOURCE_MUTATE_TARGET",
      "SAFEWORD_REVIEW_FAKE_SUMMARY",
      "SAFEWORD_REVIEW_FAKE_VERDICT",
      "SAFEWORD_REVIEW_HELP_MUTATE",
      "SAFEWORD_REVIEW_LAUNCH_LOG",
      "SAFEWORD_REVIEW_LOG",
      "SAFEWORD_REVIEW_MODEL_LOG",
      "SAFEWORD_REVIEW_MODEL_PROMPT_LOG",
      "SAFEWORD_REVIEW_PROBE_ENV_LOG",
      "SAFEWORD_REVIEW_PROMPT_LOG",
      "SAFEWORD_REVIEW_REJECTED_MODEL_BEHAVIOUR",
      "SAFEWORD_REVIEW_ROUTE_LOG",
      "SAFEWORD_REVIEW_SCHEMA_COPY",
      "SAFEWORD_REVIEW_SCHEMA_PATH_LOG",
      "SAFEWORD_REVIEW_STUBBORN_PID",
      "SAFEWORD_REVIEW_SWAP_ALIAS",
      "SAFEWORD_REVIEW_SWAP_TARGET"
    ];
  }
});

// review/scope.ts
import { AsyncLocalStorage } from "node:async_hooks";
function recordFinalizedScope(excludedTargets) {
  const scope = reviewScope.getStore();
  if (scope !== void 0) scope.excludedTargets = [...excludedTargets];
}
var reviewScope;
var init_scope = __esm({
  "review/scope.ts"() {
    "use strict";
    reviewScope = new AsyncLocalStorage();
  }
});

// review/packet.ts
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readSync,
  realpathSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import nodePath from "node:path";
function serializedOverflowIndex(kind, files, executionAttestation) {
  const logicalFiles = [];
  const contextFiles = [];
  for (const entry of files) {
    (entry.context ? contextFiles : logicalFiles).push(entry.file);
    const packet = {
      schema_version: 1,
      dispatch_id: "00000000-0000-0000-0000-000000000000",
      kind,
      logical_files: logicalFiles,
      ...contextFiles.length > 0 && { context_files: contextFiles },
      ...executionAttestation !== void 0 && { execution_attestation: executionAttestation }
    };
    if (Buffer.byteLength(JSON.stringify(packet), "utf8") > MAX_PACKET_BYTES) return entry.index;
  }
  return void 0;
}
function gitEnvironment(alternateObjects) {
  return {
    PATH: process.env.PATH,
    ...process.platform === "win32" && { SystemRoot: process.env.SystemRoot },
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_ATTR_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
    ...alternateObjects !== void 0 && { GIT_ALTERNATE_OBJECT_DIRECTORIES: alternateObjects }
  };
}
function gitOutput(args, env) {
  const result = spawnSync("git", [...args], {
    env,
    encoding: "buffer",
    timeout: 5e3,
    maxBuffer: 256 * 1024
  });
  if (result.status !== 0 || result.error !== void 0 || !Buffer.isBuffer(result.stdout)) {
    throw new ReviewPacketError(
      "Git attributes could not be resolved for an oversized review target",
      "REVIEW_TARGET_ATTRIBUTE_UNAVAILABLE"
    );
  }
  return result.stdout;
}
function readRepoPrefix(root, env) {
  const output = new TextDecoder("utf-8", { fatal: true }).decode(
    gitOutput(["-C", root, "rev-parse", "--show-prefix"], env)
  );
  const prefix = output.slice(0, -1);
  if (!output.endsWith("\n") || prefix.startsWith("/") || prefix !== "" && !prefix.endsWith("/") || prefix.split("/").includes("..")) {
    throw new ReviewPacketError(
      "Git attributes could not be resolved for an oversized review target",
      "REVIEW_TARGET_ATTRIBUTE_UNAVAILABLE"
    );
  }
  return prefix;
}
function generatedTargets(root, files) {
  if (files.length === 0) return /* @__PURE__ */ new Set();
  try {
    const env = gitEnvironment();
    const commit = gitOutput(["-C", root, "rev-parse", "--verify", "HEAD^{commit}"], env).toString("utf8").trim();
    if (!/^[0-9a-f]{40,64}$/u.test(commit)) {
      throw new ReviewPacketError(
        "Git attributes could not be resolved for an oversized review target",
        "REVIEW_TARGET_ATTRIBUTE_UNAVAILABLE"
      );
    }
    const objectsPath = gitOutput(["-C", root, "rev-parse", "--git-path", "objects"], env).toString("utf8").trim();
    const objects = realpathSync(nodePath.resolve(root, objectsPath));
    const repoPrefix = readRepoPrefix(root, env);
    const repoPaths = files.map((file) => `${repoPrefix}${file.relative}`);
    const isolatedGit = mkdtempSync(nodePath.join(tmpdir(), "safeword-review-git-"));
    try {
      const bare = nodePath.join(isolatedGit, "bare");
      const emptyTemplate = nodePath.join(isolatedGit, "template");
      mkdirSync(emptyTemplate);
      gitOutput(["init", "--bare", "-q", `--template=${emptyTemplate}`, bare], env);
      const result = spawnSync(
        "git",
        [
          "--git-dir",
          bare,
          "-c",
          `core.attributesFile=${process.platform === "win32" ? "NUL" : "/dev/null"}`,
          "check-attr",
          `--source=${commit}`,
          "-z",
          "--stdin",
          "linguist-generated"
        ],
        {
          env: gitEnvironment(objects),
          input: Buffer.from(`${repoPaths.join("\0")}\0`),
          encoding: "buffer",
          timeout: 5e3,
          maxBuffer: 256 * 1024
        }
      );
      if (result.status !== 0 || result.error !== void 0 || !Buffer.isBuffer(result.stdout)) {
        throw new ReviewPacketError(
          "Git attributes could not be resolved for an oversized review target",
          "REVIEW_TARGET_ATTRIBUTE_UNAVAILABLE"
        );
      }
      const fields = new TextDecoder("utf-8", { fatal: true }).decode(result.stdout).split("\0");
      if (fields.pop() !== "" || fields.length !== files.length * 3) {
        throw new ReviewPacketError(
          "Git attributes returned an invalid response",
          "REVIEW_TARGET_ATTRIBUTE_UNAVAILABLE"
        );
      }
      const marked = /* @__PURE__ */ new Set();
      for (const [index, file] of files.entries()) {
        const offset = index * 3;
        if (fields[offset] !== repoPaths[index] || fields[offset + 1] !== "linguist-generated") {
          throw new ReviewPacketError(
            "Git attributes returned an invalid response",
            "REVIEW_TARGET_ATTRIBUTE_UNAVAILABLE"
          );
        }
        if (fields[offset + 2] === "true") marked.add(file.relative);
      }
      return marked;
    } finally {
      rmSync(isolatedGit, { recursive: true, force: true });
    }
  } catch (error) {
    if (error instanceof ReviewPacketError) throw error;
    throw new ReviewPacketError(
      "Git attributes could not be resolved for an oversized review target",
      "REVIEW_TARGET_ATTRIBUTE_UNAVAILABLE"
    );
  }
}
function oversizedState(root, file) {
  try {
    const observed = lstatSync(file.source);
    if (escapes(root, realpathSync(file.source))) return "outside";
    if (!observed.isFile() || observed.dev !== file.device || observed.ino !== file.inode || observed.size !== file.size)
      return "changed";
    return "same";
  } catch {
    return "changed";
  }
}
function collectOversizedOutcomes(root, files, marked, errors, excluded) {
  for (const file of files) {
    const state = oversizedState(root, file);
    if (state !== "same") {
      errors.push({
        index: file.index,
        error: new ReviewPacketError(
          state === "outside" ? `Review target escapes the project: ${file.relative}` : `Review target changed while it was being classified: ${file.relative}`,
          state === "outside" ? "REVIEW_TARGET_OUTSIDE_PROJECT" : "REVIEW_TARGET_CHANGED"
        )
      });
      continue;
    }
    if (!marked.has(file.relative)) {
      errors.push({
        index: file.index,
        error: new ReviewPacketError(
          `Review target exceeds the ${MAX_FILE_BYTES}-byte limit: ${file.relative}`,
          "REVIEW_TARGET_TOO_LARGE"
        )
      });
      continue;
    }
    excluded.push(file.relative);
  }
}
function requireScenarioTicketSpec(kind, contextFiles) {
  if (kind !== "scenario-gate") return;
  const ticketSpec = contextFiles[0];
  if (ticketSpec === void 0 || nodePath.basename(ticketSpec.path) !== "spec.md" || ticketSpec.content.trim() === "") {
    throw new ReviewPacketError(
      "Scenario-gate review requires a non-blank spec.md as its first context file"
    );
  }
}
function requirePlanWorkArtifact(kind, logicalFiles) {
  if (kind !== "plan-implementation") return;
  const plan = logicalFiles[0];
  if (logicalFiles.length !== 1 || plan === void 0 || nodePath.basename(plan.path) !== "impl-plan.md" || plan.content.trim() === "") {
    throw new ReviewPacketError(
      "Plan-implementation review requires one non-blank impl-plan.md work file; pass supporting evidence with --context"
    );
  }
}
function requireExecutableRedAttestation(kind, attestation) {
  if (kind === "executable-red" && attestation === void 0) {
    throw new ReviewPacketError("Executable-red review requires a trusted execution attestation");
  }
  if (kind !== "executable-red" && attestation !== void 0) {
    throw new ReviewPacketError(
      "Trusted execution attestations are accepted only for executable-red review"
    );
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
  let descriptor;
  try {
    descriptor = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const stat = fstatSync(descriptor);
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES) return void 0;
    const bytes = readBounded(descriptor, MAX_FILE_BYTES);
    return bytes === void 0 ? void 0 : digest(bytes);
  } catch {
    return void 0;
  } finally {
    if (descriptor !== void 0) closeSync(descriptor);
  }
}
function readBounded(descriptor, maxBytes) {
  const buffer = Buffer.allocUnsafe(maxBytes + 1);
  let length = 0;
  while (length < buffer.length) {
    const read = readSync(descriptor, buffer, length, buffer.length - length, null);
    if (read === 0) return buffer.subarray(0, length);
    length += read;
  }
  return void 0;
}
function sourceFileChanged(root, file) {
  let descriptor;
  try {
    descriptor = openSync(file.source, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const current = fstatSync(descriptor);
    if (!current.isFile() || current.dev !== file.device || current.ino !== file.inode) return true;
    if (escapes(root, realpathSync(file.source))) return true;
    const bytes = readBounded(descriptor, MAX_FILE_BYTES);
    return bytes === void 0 || digest(bytes) !== file.sha256;
  } catch {
    return true;
  } finally {
    if (descriptor !== void 0) closeSync(descriptor);
  }
}
function requireStableSources(root, files) {
  if (files.some((file) => sourceFileChanged(root, file))) {
    throw new ReviewPacketError(
      "Review target changed after packet capture",
      "REVIEW_TARGET_CHANGED"
    );
  }
}
function throwFirstTargetError(errors) {
  if (errors.length === 0) return;
  errors.sort((left, right) => left.index - right.index);
  throw errors[0]?.error;
}
function readContainedText(root, source, target, packetBytesRemaining) {
  const descriptor = openSync(source, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = fstatSync(descriptor);
    if (!opened.isFile()) {
      throw new ReviewPacketError(
        `Review target is not a regular file: ${target}`,
        "REVIEW_TARGET_NOT_REGULAR"
      );
    }
    if (opened.size > MAX_FILE_BYTES) {
      throw new ReviewPacketError(
        `Review target changed while it was being captured: ${target}`,
        "REVIEW_TARGET_CHANGED"
      );
    }
    if (opened.size > packetBytesRemaining) {
      throw new ReviewPacketError(
        `Review packet exceeds the ${MAX_PACKET_BYTES}-byte limit`,
        "REVIEW_PACKET_TOO_LARGE"
      );
    }
    const resolved = realpathSync(source);
    if (escapes(root, resolved)) {
      throw new ReviewPacketError(
        `Review target escapes the project: ${target}`,
        "REVIEW_TARGET_OUTSIDE_PROJECT"
      );
    }
    const observed = lstatSync(resolved);
    if (opened.dev !== observed.dev || opened.ino !== observed.ino) {
      throw new ReviewPacketError(
        `Review target changed while it was being captured: ${target}`,
        "REVIEW_TARGET_CHANGED"
      );
    }
    const bytes = readBounded(descriptor, MAX_FILE_BYTES);
    if (bytes?.byteLength !== opened.size) {
      throw new ReviewPacketError(
        `Review target changed while it was being captured: ${target}`,
        "REVIEW_TARGET_CHANGED"
      );
    }
    let content;
    try {
      content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new ReviewPacketError(
        `Review target is not valid UTF-8 text: ${target}`,
        "REVIEW_TARGET_INVALID_TEXT"
      );
    }
    if (HIGH_CONFIDENCE_SECRET_PATTERNS.some((pattern) => pattern.test(content))) {
      throw new Error(
        `Review packet rejected a high-confidence credential in ${target}; redact it before dispatch`
      );
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
function toReviewPath(relative, separator = nodePath.sep) {
  return relative.split(separator).join("/");
}
function snapshotEntries(root, directory = root) {
  return readdirSync(directory).flatMap((name) => {
    const path = nodePath.join(directory, name);
    const relative = nodePath.relative(root, path);
    const stats = lstatSync(path);
    if (stats.isDirectory()) return [`directory:${relative}`, ...snapshotEntries(root, path)];
    if (stats.isFile()) return [`file:${relative}`];
    return [`other:${relative}`];
  });
}
function writeReviewSnapshot(workspace, relative, bytes) {
  if (workspace === "") return "";
  const snapshotPath = nodePath.join(workspace, relative);
  mkdirSync(nodePath.dirname(snapshotPath), { recursive: true });
  writeFileSync(snapshotPath, bytes, { mode: 384 });
  return snapshotPath;
}
function removeReviewSnapshot(workspace) {
  if (workspace !== "") rmSync(workspace, { recursive: true, force: true });
}
function prepareReviewPacketUnsafe(cwd, kind, targets, context = [], execution = {}, snapshot = true) {
  const executionAttestation = checkedExecutionAttestation(kind, execution);
  const canonicalRoot = realpathSync(cwd);
  const workspace = snapshot ? mkdtempSync(nodePath.join(tmpdir(), "safeword-review-")) : "";
  const tracked = [];
  const oversized = [];
  const captured = [];
  const targetErrors = [];
  const excludedTargets = [];
  const expectedSnapshotEntries = /* @__PURE__ */ new Set();
  let logicalFiles;
  let contextFiles;
  try {
    let packetBytes = 0;
    const captureFiles = (files, allowGenerated, offset) => files.flatMap((target, index) => {
      try {
        const source = nodePath.resolve(canonicalRoot, target);
        const relative = nodePath.relative(canonicalRoot, source);
        if (escapes(canonicalRoot, source)) {
          throw new ReviewPacketError(
            `Review target escapes the project: ${target}`,
            "REVIEW_TARGET_OUTSIDE_PROJECT"
          );
        }
        const stats = lstatSync(source);
        if (escapes(canonicalRoot, realpathSync(source))) {
          throw new ReviewPacketError(
            `Review target escapes the project: ${target}`,
            "REVIEW_TARGET_OUTSIDE_PROJECT"
          );
        }
        if (!stats.isFile()) {
          throw new ReviewPacketError(
            `Review target is not a regular file: ${target}`,
            "REVIEW_TARGET_NOT_REGULAR"
          );
        }
        if (stats.size > MAX_FILE_BYTES) {
          if (!allowGenerated) {
            throw new ReviewPacketError(
              `Review target exceeds the ${MAX_FILE_BYTES}-byte limit: ${target}`,
              "REVIEW_TARGET_TOO_LARGE"
            );
          }
          oversized.push({
            index: offset + index,
            source,
            relative: toReviewPath(relative),
            device: stats.dev,
            inode: stats.ino,
            size: stats.size
          });
          return [];
        }
        const { bytes, content, device, inode } = readContainedText(
          canonicalRoot,
          source,
          target,
          MAX_PACKET_BYTES - packetBytes
        );
        const fileBytes = bytes.byteLength;
        if (fileBytes > MAX_FILE_BYTES) {
          throw new Error(`Review target exceeds the ${MAX_FILE_BYTES}-byte limit: ${target}`);
        }
        packetBytes += fileBytes;
        if (packetBytes > MAX_PACKET_BYTES) {
          throw new ReviewPacketError(
            `Review packet exceeds the ${MAX_PACKET_BYTES}-byte limit`,
            "REVIEW_PACKET_TOO_LARGE"
          );
        }
        const snapshotPath = writeReviewSnapshot(workspace, relative, bytes);
        let parent = nodePath.dirname(relative);
        while (parent !== ".") {
          expectedSnapshotEntries.add(`directory:${parent}`);
          parent = nodePath.dirname(parent);
        }
        expectedSnapshotEntries.add(`file:${relative}`);
        tracked.push({ source, snapshot: snapshotPath, sha256: digest(bytes), device, inode });
        const file = { path: toReviewPath(relative), content };
        captured.push({ index: offset + index, context: !allowGenerated, file });
        return [file];
      } catch (error) {
        targetErrors.push({ index: offset + index, error });
        return [];
      }
    });
    const seen = /* @__PURE__ */ new Set();
    const rejectDuplicate = (target) => {
      const relative = nodePath.relative(canonicalRoot, nodePath.resolve(canonicalRoot, target));
      if (seen.has(relative)) {
        throw new Error(`Review packet contains a duplicate file: ${target}`);
      }
      seen.add(relative);
    };
    const uniqueTargets = [];
    for (const target of targets) {
      const relative = nodePath.relative(canonicalRoot, nodePath.resolve(canonicalRoot, target));
      if (seen.has(relative)) continue;
      rejectDuplicate(target);
      uniqueTargets.push(target);
    }
    for (const target of context) rejectDuplicate(target);
    if (uniqueTargets.length + context.length > MAX_FILE_COUNT) {
      throw new ReviewPacketError(
        `Review packet exceeds the ${MAX_FILE_COUNT}-file limit`,
        "REVIEW_PACKET_TOO_LARGE"
      );
    }
    logicalFiles = captureFiles(uniqueTargets, true, 0);
    contextFiles = captureFiles(context, false, uniqueTargets.length);
    requireStableSources(canonicalRoot, tracked);
    const overflowIndex = serializedOverflowIndex(kind, captured, executionAttestation);
    if (overflowIndex !== void 0) {
      targetErrors.push({
        index: overflowIndex,
        error: new ReviewPacketError(
          `Review packet exceeds the ${MAX_PACKET_BYTES}-byte limit`,
          "REVIEW_PACKET_TOO_LARGE"
        )
      });
    }
    let marked;
    try {
      marked = generatedTargets(canonicalRoot, oversized);
    } catch (error) {
      const firstOversizedIndex = oversized[0]?.index ?? Infinity;
      const earlierFailure = targetErrors.filter((failure) => failure.index < firstOversizedIndex).toSorted((left, right) => left.index - right.index)[0];
      throw earlierFailure?.error ?? error;
    }
    collectOversizedOutcomes(canonicalRoot, oversized, marked, targetErrors, excludedTargets);
    requireStableSources(canonicalRoot, tracked);
    throwFirstTargetError(targetErrors);
    if (logicalFiles.length === 0) {
      throw new ReviewPacketError(
        targets.length === 0 ? "Review has no submitted targets" : "Review has no eligible targets after generated outputs are excluded",
        "REVIEW_NO_ELIGIBLE_TARGETS"
      );
    }
    requireScenarioTicketSpec(kind, contextFiles);
    requirePlanWorkArtifact(kind, logicalFiles);
  } catch (error) {
    removeReviewSnapshot(workspace);
    throw error;
  }
  const packet = {
    schema_version: 1,
    dispatch_id: randomUUID(),
    kind,
    logical_files: logicalFiles,
    ...contextFiles.length > 0 && { context_files: contextFiles },
    ...executionAttestation !== void 0 && { execution_attestation: executionAttestation }
  };
  if (Buffer.byteLength(JSON.stringify(packet), "utf8") > MAX_PACKET_BYTES) {
    removeReviewSnapshot(workspace);
    throw new ReviewPacketError(
      `Review packet exceeds the ${MAX_PACKET_BYTES}-byte limit`,
      "REVIEW_PACKET_TOO_LARGE"
    );
  }
  return {
    packet,
    excludedTargets,
    sourceRoot: canonicalRoot,
    workspace,
    sourceChanged: () => tracked.some((file) => sourceFileChanged(canonicalRoot, file)),
    snapshotChanged: () => {
      if (!snapshot) return false;
      if (tracked.some((file) => fileDigest(file.snapshot) !== file.sha256)) return true;
      try {
        const actualEntries = snapshotEntries(workspace);
        return actualEntries.length !== expectedSnapshotEntries.size || actualEntries.some((entry) => !expectedSnapshotEntries.has(entry));
      } catch {
        return true;
      }
    },
    cleanup: () => {
      removeReviewSnapshot(workspace);
    }
  };
}
function prepareReviewPacket(cwd, kind, targets, context = [], execution = {}) {
  try {
    const prepared = prepareReviewPacketUnsafe(cwd, kind, targets, context, execution);
    recordFinalizedScope(prepared.excludedTargets);
    return prepared;
  } catch (error) {
    if (error instanceof ReviewPacketError) throw error;
    const message = error instanceof Error ? error.message : "";
    throw new ReviewPacketError(
      message.startsWith("Review ") ? message : "Review packet could not be prepared. Check that every target and context path exists and is readable."
    );
  }
}
function prepareReviewPacketReadOnly(cwd, kind, targets, context = [], execution = {}) {
  try {
    return prepareReviewPacketUnsafe(cwd, kind, targets, context, execution, false);
  } catch (error) {
    if (error instanceof ReviewPacketError) throw error;
    throw new ReviewPacketError("Review packet could not be read for verification.");
  }
}
var MAX_FILE_COUNT, MAX_FILE_BYTES, MAX_PACKET_BYTES, HIGH_CONFIDENCE_SECRET_PATTERNS, ReviewPacketError;
var init_packet = __esm({
  "review/packet.ts"() {
    "use strict";
    init_scope();
    MAX_FILE_COUNT = 64;
    MAX_FILE_BYTES = 256 * 1024;
    MAX_PACKET_BYTES = 1024 * 1024;
    HIGH_CONFIDENCE_SECRET_PATTERNS = [
      /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/u,
      /\bAKIA[0-9A-Z]{16}\b/u,
      /\bgh[pousr]_[A-Za-z0-9]{36,}\b/u,
      /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/u,
      /\bsk-(?:proj-|ant-)[\w-]{16,}\b/u,
      /\bAIza[\w-]{35}\b/u
    ];
    ReviewPacketError = class extends Error {
      constructor(message, code = "REVIEW_PACKET_INVALID") {
        super(message);
        this.code = code;
      }
      code;
      name = "ReviewPacketError";
    };
  }
});

// codex-plugin/durable-write.ts
var init_durable_write = __esm({
  "codex-plugin/durable-write.ts"() {
    "use strict";
  }
});

// review/route-config.ts
var MODEL_NAME;
var init_route_config = __esm({
  "review/route-config.ts"() {
    "use strict";
    MODEL_NAME = /^[\w.:/][\w.:/-]{0,199}$/u;
  }
});

// review/preferences.ts
import nodePath2 from "node:path";
function resolveSafewordUserConfigPath(input) {
  const paths2 = input.platform === "windows" ? nodePath2.win32 : nodePath2.posix;
  const xdg = absolute(input.env.XDG_CONFIG_HOME, paths2);
  if (xdg !== void 0) return paths2.join(xdg, "safeword", "config.json");
  if (input.platform === "windows") {
    const appData = absolute(input.env.APPDATA, paths2);
    if (appData !== void 0) return paths2.join(appData, "Safeword", "config.json");
    const profile = absolute(input.env.USERPROFILE, paths2);
    return profile === void 0 ? void 0 : paths2.join(profile, ".config", "safeword", "config.json");
  }
  const home = absolute(input.env.HOME, paths2);
  return home === void 0 ? void 0 : paths2.join(home, ".config", "safeword", "config.json");
}
function absolute(value, paths2) {
  const trimmed = value?.trim();
  return trimmed !== void 0 && paths2.isAbsolute(trimmed) ? trimmed : void 0;
}
function currentUserConfigPath() {
  const path = optionalCurrentUserConfigPath();
  if (path === void 0)
    throw new ReviewUserConfigPathError("Cannot locate the Safeword user configuration directory.");
  return path;
}
function optionalCurrentUserConfigPath() {
  return resolveSafewordUserConfigPath({
    platform: process.platform === "win32" ? "windows" : "unix",
    env: process.env
  });
}
function scopedConfigPath(cwd, scope) {
  return scope === "project" ? nodePath2.join(cwd, ".safeword", "config.json") : currentUserConfigPath();
}
var ReviewUserConfigPathError;
var init_preferences = __esm({
  "review/preferences.ts"() {
    "use strict";
    init_durable_write();
    init_route_config();
    ReviewUserConfigPathError = class extends Error {
      name = "ReviewUserConfigPathError";
    };
  }
});

// utils/output.ts
var init_output = __esm({
  "utils/output.ts"() {
    "use strict";
  }
});

// review/plan-rubric.generated.ts
var init_plan_rubric_generated = __esm({
  "review/plan-rubric.generated.ts"() {
    "use strict";
  }
});

// review/quality-rubric.generated.ts
var init_quality_rubric_generated = __esm({
  "review/quality-rubric.generated.ts"() {
    "use strict";
  }
});

// review/red-rubric.generated.ts
var init_red_rubric_generated = __esm({
  "review/red-rubric.generated.ts"() {
    "use strict";
  }
});

// review/scenario-rubric.generated.ts
var init_scenario_rubric_generated = __esm({
  "review/scenario-rubric.generated.ts"() {
    "use strict";
  }
});

// review/runtime.ts
import { createHash as createHash2 } from "node:crypto";
import {
  accessSync,
  chmodSync,
  closeSync as closeSync2,
  constants as constants2,
  fstatSync as fstatSync2,
  lstatSync as lstatSync2,
  mkdirSync as mkdirSync2,
  mkdtempSync as mkdtempSync2,
  openSync as openSync2,
  readdirSync as readdirSync2,
  readFileSync,
  realpathSync as realpathSync2,
  renameSync,
  rmSync as rmSync2,
  writeFileSync as writeFileSync2
} from "node:fs";
import { homedir, tmpdir as tmpdir2 } from "node:os";
import nodePath3 from "node:path";
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
function inside(root, candidate) {
  const relative = nodePath3.relative(root, candidate);
  return relative === "" || !nodePath3.isAbsolute(relative) && !relative.startsWith(`..${nodePath3.sep}`) && relative !== "..";
}
function outsideUntrustedRoot(root, candidate) {
  if (inside(root, candidate)) return false;
  try {
    return !inside(root, realpathSync2(candidate));
  } catch {
    return false;
  }
}
function pathMetadataIsTrusted(mode, ownerUid, currentUid) {
  const ownedByCurrentUser = currentUid !== void 0 && ownerUid === currentUid;
  return (mode & 2) === 0 && (mode & 16) === 0 && (currentUid === void 0 || ownerUid === 0 || ownedByCurrentUser);
}
function currentUserId() {
  return typeof process.getuid === "function" ? process.getuid() : void 0;
}
function hasTrustedExecutableAncestry(candidate) {
  if (process.platform === "win32") return true;
  const currentUid = currentUserId();
  let current = candidate;
  while (true) {
    const metadata = lstatSync2(current);
    if (!pathMetadataIsTrusted(metadata.mode, metadata.uid, currentUid)) return false;
    const parent = nodePath3.dirname(current);
    if (parent === current) return true;
    current = parent;
  }
}
function digestOpenFile(fd) {
  if (!fstatSync2(fd).isFile()) return void 0;
  const bytes = readFileSync(fd);
  return { bytes, digest: createHash2("sha256").update(bytes).digest("hex") };
}
function cachedCopyMatchesDigest(copyPath, expectedDigest) {
  let cachedFd;
  try {
    cachedFd = openSync2(copyPath, constants2.O_RDONLY);
    return digestOpenFile(cachedFd)?.digest === expectedDigest;
  } catch {
    return false;
  } finally {
    if (cachedFd !== void 0) closeSync2(cachedFd);
  }
}
function preparedTrustedCacheDirectory(untrustedRoot) {
  const cacheDirectory = process.env.SAFEWORD_REVIEWER_CACHE_DIR ?? nodePath3.join(homedir(), ".cache", "safeword-reviewers");
  if (inside(untrustedRoot, cacheDirectory)) return void 0;
  try {
    if (lstatSync2(cacheDirectory).isSymbolicLink()) return void 0;
  } catch {
  }
  mkdirSync2(cacheDirectory, { recursive: true, mode: 448 });
  if (lstatSync2(cacheDirectory).isSymbolicLink()) return void 0;
  const resolved = realpathSync2(cacheDirectory);
  if (!outsideUntrustedRoot(untrustedRoot, resolved)) return void 0;
  chmodSync(resolved, 448);
  return resolved;
}
function stagedTrustedReviewerCopy(reviewer, canonical, untrustedRoot) {
  let sourceFd;
  try {
    sourceFd = openSync2(canonical, constants2.O_RDONLY);
    const sourceMetadata = fstatSync2(sourceFd);
    const currentUid = currentUserId();
    if (!pathMetadataIsTrusted(sourceMetadata.mode, sourceMetadata.uid, currentUid)) {
      return void 0;
    }
    const source = digestOpenFile(sourceFd);
    if (source === void 0) return void 0;
    const cacheDirectory = preparedTrustedCacheDirectory(untrustedRoot);
    if (cacheDirectory === void 0) return void 0;
    const copyPath = nodePath3.join(cacheDirectory, `${reviewer}.${source.digest}`);
    if (cachedCopyMatchesDigest(copyPath, source.digest)) return copyPath;
    const temporaryPath = `${copyPath}.${process.pid.toString(36)}.${Date.now().toString(36)}.tmp`;
    writeFileSync2(temporaryPath, source.bytes, { mode: 448, flag: "wx" });
    renameSync(temporaryPath, copyPath);
    return copyPath;
  } catch {
    return void 0;
  } finally {
    if (sourceFd !== void 0) closeSync2(sourceFd);
  }
}
function executableCandidates(reviewer, untrustedRoot, allowStaging = true) {
  const canonicalUntrustedRoot = realpathSync2(untrustedRoot);
  const extensions = process.platform === "win32" ? (process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";").map((extension) => extension.toLowerCase()) : [""];
  const candidates = (process.env.PATH ?? "").split(nodePath3.delimiter).filter((directory) => directory !== "" && nodePath3.isAbsolute(directory)).flatMap(
    (directory) => extensions.map((extension) => nodePath3.join(directory, `${reviewer}${extension}`))
  );
  let rejectedForTrust = false;
  const stageable = [];
  const canonicalCandidates = candidates.flatMap((candidate) => {
    if (inside(untrustedRoot, candidate)) return [];
    try {
      const canonical = realpathSync2(candidate);
      if (!outsideUntrustedRoot(canonicalUntrustedRoot, canonical)) return [];
      accessSync(canonical, constants2.X_OK);
      if (!hasTrustedExecutableAncestry(canonical)) {
        rejectedForTrust = true;
        stageable.push(canonical);
        return [];
      }
      return [canonical];
    } catch {
      return [];
    }
  });
  const trusted = [...new Set(canonicalCandidates)];
  if (trusted.length > 0) return { paths: trusted, rejectedForTrust };
  if (!allowStaging) return { paths: [], rejectedForTrust };
  const staged = stageable.flatMap((canonical) => {
    const copy = stagedTrustedReviewerCopy(reviewer, canonical, canonicalUntrustedRoot);
    return copy !== void 0 && hasTrustedExecutableAncestry(copy) ? [copy] : [];
  });
  return { paths: [...new Set(staged)], rejectedForTrust };
}
function trustedReviewerExecutable(reviewer, untrustedRoot) {
  const candidates = executableCandidates(reviewer, untrustedRoot);
  const executable = candidates.paths[0];
  if (executable === void 0)
    throw unavailableReviewerError(reviewer, candidates.rejectedForTrust);
  return executable;
}
function unavailableReviewerError(reviewer, rejectedForTrust) {
  if (rejectedForTrust) {
    return new ReviewRuntimeError(
      "untrusted_install",
      `${reviewer} reviewer installation has an untrusted writable ancestor`
    );
  }
  return new ReviewRuntimeError("not_installed", `No compatible ${reviewer} reviewer is installed`);
}
var REVIEW_OUTPUT_SCHEMA_SHAPE, REVIEW_OUTPUT_SCHEMA, MAX_OUTPUT_BYTES, ReviewRuntimeError, RUN_BOUND_MS, BACKGROUND_RUN_BOUND_MS;
var init_runtime = __esm({
  "review/runtime.ts"() {
    "use strict";
    init_output();
    init_environment();
    init_plan_rubric_generated();
    init_quality_rubric_generated();
    init_red_rubric_generated();
    init_scenario_rubric_generated();
    init_scope();
    REVIEW_OUTPUT_SCHEMA_SHAPE = {
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
    REVIEW_OUTPUT_SCHEMA = JSON.stringify(REVIEW_OUTPUT_SCHEMA_SHAPE);
    MAX_OUTPUT_BYTES = 1024 * 1024;
    ReviewRuntimeError = class extends Error {
      constructor(failure, message, terminal = false) {
        super(message);
        this.failure = failure;
        this.terminal = terminal;
        this.name = "ReviewRuntimeError";
      }
      failure;
      terminal;
    };
    RUN_BOUND_MS = 27e4;
    BACKGROUND_RUN_BOUND_MS = 18e5;
  }
});

// review/job.ts
var job_exports = {};
__export(job_exports, {
  ReviewAuthenticationContextChangedError: () => ReviewAuthenticationContextChangedError,
  approvedRetrospectiveReview: () => approvedRetrospectiveReview,
  assertReviewAuthenticationContext: () => assertReviewAuthenticationContext,
  cancelReviewJob: () => cancelReviewJob,
  completeReviewJob: () => completeReviewJob,
  executableRedGate: () => executableRedGate,
  hasIndependentVerdict: () => hasIndependentVerdict,
  readReviewRouteProofs: () => readReviewRouteProofs,
  relayManagedWorkerStderr: () => relayManagedWorkerStderr,
  resumeReviewAfterAuthentication: () => resumeReviewAfterAuthentication,
  retrospectiveCloseTag: () => retrospectiveCloseTag,
  reviewJobStatus: () => reviewJobStatus,
  reviewJobWorkerInput: () => reviewJobWorkerInput,
  startReviewJob: () => startReviewJob,
  validRetrospectiveCloseTag: () => validRetrospectiveCloseTag
});
import { spawn, spawnSync as spawnSync2 } from "node:child_process";
import { createHash as createHash3, createHmac, randomBytes, randomUUID as randomUUID2, timingSafeEqual } from "node:crypto";
import {
  closeSync as closeSync3,
  existsSync,
  fstatSync as fstatSync3,
  mkdirSync as mkdirSync3,
  openSync as openSync3,
  readdirSync as readdirSync3,
  readFileSync as readFileSync2,
  realpathSync as realpathSync3,
  renameSync as renameSync2,
  statSync,
  unlinkSync,
  writeFileSync as writeFileSync3,
  writeSync
} from "node:fs";
import { homedir as homedir2 } from "node:os";
import nodePath4 from "node:path";
function assignedAuthenticationReviewer(data) {
  const reviewer = data?.assigned_reviewer;
  return reviewer === "claude" || reviewer === "codex" ? reviewer : void 0;
}
function authenticationReviewer(record) {
  if (!AUTHENTICATION_REVIEW_KINDS.has(record.kind)) return void 0;
  if (record.retry_of !== void 0 || record.state !== "completed") return void 0;
  const result = record.result;
  if (result?.findings.some((finding) => finding.code === "REVIEW_AUTHENTICATION_REQUIRED") !== true)
    return void 0;
  const reviewer = assignedAuthenticationReviewer(result.data);
  if (reviewer === void 0) return void 0;
  return record.authentication_bindings?.[reviewer] === void 0 ? void 0 : reviewer;
}
function authenticationContext(cwd, reviewer) {
  return {
    executable: trustedReviewerExecutable(reviewer, cwd),
    environment: reviewerEnvironment(reviewer)
  };
}
function authenticationBinding(cwd, context) {
  const root = realpathSync3.native(cwd);
  const policyPaths = [scopedConfigPath(root, "project"), scopedConfigPath(root, "user")];
  const controls = Object.entries(process.env).filter(
    ([name]) => name === "SAFEWORD_AGENT_RUNTIME" || name === "SAFEWORD_REVIEW_EFFORT_CLAUDE" || /^SAFEWORD_REVIEW_(?:PRIMARY|ALTERNATE)_MODEL_(?:CLAUDE|CODEX|OPENCODE)$/u.test(name)
  ).toSorted(([left], [right]) => left.localeCompare(right));
  const policies = policyPaths.map((path) => [
    path,
    existsSync(path) ? readFileSync2(path).toString("base64") : void 0
  ]);
  const executableBytes = readFileSync2(context.executable);
  return createHmac("sha256", readOrCreateIntegrityKey()).update(
    JSON.stringify({
      root,
      policies,
      controls,
      executable: realpathSync3.native(context.executable),
      executable_bytes: createHash3("sha256").update(executableBytes).digest("hex"),
      environment: Object.entries(context.environment).toSorted(
        ([left], [right]) => left.localeCompare(right)
      )
    })
  ).digest("hex");
}
function captureAuthenticationBindings(cwd) {
  const bindings = {};
  for (const reviewer of ["claude", "codex"]) {
    try {
      bindings[reviewer] = authenticationBinding(cwd, authenticationContext(cwd, reviewer));
    } catch {
    }
  }
  return bindings;
}
function authenticationRetryId(parent) {
  const hex = createHash3("sha256").update(`safeword-authentication-retry:${parent}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
function assertReviewAuthenticationContext(cwd, id, reviewer, context) {
  const original = readJob(cwd, id, true);
  if (authenticationReviewer(original) !== reviewer)
    throw new Error(
      "The review is not eligible for automatic authentication recovery. Retry manually."
    );
  if (original.authentication_bindings?.[reviewer] !== authenticationBinding(cwd, context) || reviewIdentity(cwd, original.kind, original.targets, original.context, original.execution, true).fingerprint !== original.source_fingerprint)
    throw new ReviewAuthenticationContextChangedError(
      "The review execution context changed. Retry manually."
    );
}
function verifiedAuthenticationParent(cwd, retry) {
  retry.signal.throwIfAborted();
  const parent = readJob(cwd, retry.parent, true);
  assertReviewAuthenticationContext(
    cwd,
    parent.id,
    retry.reviewer,
    authenticationContext(cwd, retry.reviewer)
  );
  return parent;
}
function linkedAuthenticationRetry(parent, child) {
  return child.retry_of === parent.id && child.id === authenticationRetryId(parent.id) && child.kind === parent.kind && child.source_fingerprint === parent.source_fingerprint && JSON.stringify(child.targets) === JSON.stringify(parent.targets) && JSON.stringify(child.context ?? []) === JSON.stringify(parent.context ?? []) && JSON.stringify(child.authentication_bindings) === JSON.stringify(parent.authentication_bindings);
}
async function resumeReviewAfterAuthentication(cwd, id, reviewer, signal) {
  const parent = readJob(cwd, id, true);
  return startReviewJob({
    cwd,
    kind: parent.kind,
    targets: parent.targets,
    context: parent.context,
    authenticationRetry: { parent: id, reviewer, signal }
  });
}
function jobsDirectory(cwd) {
  return nodePath4.join(cwd, ".safeword", "state", "reviews");
}
function jobPath(cwd, id) {
  if (!isJobId(id)) throw new Error("invalid review job id");
  return nodePath4.join(jobsDirectory(cwd), `${id}.json`);
}
function integrityKeyPath() {
  const testRoot = process.env.SAFEWORD_REVIEW_KEY_ROOT;
  const stateRoot = process.env.NODE_ENV === "test" && testRoot !== void 0 ? testRoot : process.env.XDG_STATE_HOME ?? nodePath4.join(homedir2(), ".local", "state");
  return nodePath4.join(stateRoot, "safeword", "review-integrity.key");
}
function readOrCreateIntegrityKey() {
  const keyPath = integrityKeyPath();
  try {
    return decodeIntegrityKey(readFileSync2(keyPath, "utf8"));
  } catch {
    mkdirSync3(nodePath4.dirname(keyPath), { recursive: true, mode: 448 });
    const key = randomBytes(32);
    try {
      const descriptor = openSync3(keyPath, "wx", 384);
      try {
        writeFileSync3(descriptor, `${key.toString("hex")}
`);
      } finally {
        closeSync3(descriptor);
      }
      return key;
    } catch (error) {
      if (!isFileExistsError(error)) throw error;
      return decodeIntegrityKey(readFileSync2(keyPath, "utf8"));
    }
  }
}
function decodeIntegrityKey(value) {
  const encoded = value.trim();
  if (!/^[a-f\d]{64}$/u.test(encoded)) throw new Error("invalid review integrity key");
  return Buffer.from(encoded, "hex");
}
function unsignedRecord(record) {
  const { integrity: _integrity, ...unsigned } = record;
  return unsigned;
}
function recordIntegrity(cwd, record, readOnly = false) {
  const key = readOnly ? decodeIntegrityKey(readFileSync2(integrityKeyPath(), "utf8")) : readOrCreateIntegrityKey();
  return createHmac("sha256", key).update(realpathSync3.native(cwd)).update("\0").update(JSON.stringify(unsignedRecord(record))).digest("hex");
}
function hasValidIntegrity(cwd, record, readOnly = false) {
  if (record.integrity === void 0 || !/^[a-f\d]{64}$/u.test(record.integrity)) return false;
  try {
    const actual = Buffer.from(record.integrity, "hex");
    const expected = Buffer.from(recordIntegrity(cwd, record, readOnly), "hex");
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
function withRecordIntegrity(cwd, record) {
  const unsigned = { ...record, integrity: void 0 };
  return { ...unsigned, integrity: recordIntegrity(cwd, unsigned) };
}
function retrospectiveCloseTag(cwd, content) {
  return createHmac("sha256", readOrCreateIntegrityKey()).update(realpathSync3.native(cwd)).update("\0retrospective-close\0").update(content).digest("hex");
}
function validRetrospectiveCloseTag(cwd, content, tag) {
  if (!/^[a-f\d]{64}$/u.test(tag)) return false;
  try {
    return timingSafeEqual(
      Buffer.from(tag, "hex"),
      Buffer.from(retrospectiveCloseTag(cwd, content), "hex")
    );
  } catch {
    return false;
  }
}
function splitExecutionPlanRow(line) {
  if (!line.trimStart().startsWith("|") || !line.trimEnd().endsWith("|")) return void 0;
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
  if (escaped) cell += "\\";
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
  if (pipes.length !== DELIVERY_CHECKLIST_COLUMNS + 1) return line;
  const stableEnd = pipes[5];
  const finalPipe = pipes[9];
  if (stableEnd === void 0 || finalPipe === void 0) return line;
  return `${line.slice(0, stableEnd + 1)} <progress> | <progress> | <progress> | <progress> ${line.slice(finalPipe)}`;
}
function hasExecutionPlanDeliveryChecklist(content) {
  return content.split("\n").some((line) => line.trim() === DELIVERY_CHECKLIST_MARKER);
}
function normalizedExecutionPlanDigest(content) {
  const lines = content.split("\n");
  const markerIndex = lines.findIndex((line) => line.trim() === DELIVERY_CHECKLIST_MARKER);
  if (markerIndex !== -1) {
    const headerIndex = lines.findIndex((line, index) => {
      if (index <= markerIndex) return false;
      const cells = splitExecutionPlanRow(line);
      return cells?.length === DELIVERY_CHECKLIST_COLUMNS && cells[0] === "ID" && cells[5] === "Disposition";
    });
    for (let index = headerIndex + 1; headerIndex !== -1 && index < lines.length; index += 1) {
      const line = lines[index];
      if (line === void 0 || splitExecutionPlanRow(line)?.length !== DELIVERY_CHECKLIST_COLUMNS)
        break;
      lines[index] = normalizeExecutionPlanProgress(line);
    }
  }
  return createHash3("sha256").update(lines.join("\n")).digest("hex");
}
function executionPlanReviewIdentity(content, projectDirectory) {
  const configPath = nodePath4.join(projectDirectory, ".safeword", "config.json");
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
  if (execution === void 0) return { context, missing: false };
  const canonicalRoot = realpathSync3.native(cwd);
  const ledgerPath = nodePath4.resolve(canonicalRoot, execution.ledger);
  if (pathEscapes(canonicalRoot, ledgerPath)) {
    throw new Error(`Executable RED ledger escapes the project: ${execution.ledger}`);
  }
  const missing = !existsSync(ledgerPath);
  const included = [...targets, ...context].some(
    (target) => nodePath4.resolve(canonicalRoot, target) === ledgerPath
  );
  return {
    context: included || missing ? context : [...context, execution.ledger],
    missing
  };
}
function reviewIdentity(cwd, kind, targets, context = [], execution, readOnly = false) {
  const ledger = ledgerFingerprintContext(cwd, targets, context, execution);
  const prepared = (readOnly ? prepareReviewPacketReadOnly : prepareReviewPacket)(
    cwd,
    kind,
    targets,
    ledger.context,
    {
      allowMissingExecutableRedAttestation: true
    }
  );
  try {
    const hash = createHash3("sha256");
    hash.update(`kind\0${kind}\0`);
    if (execution !== void 0) hash.update(`execution\0${JSON.stringify(execution)}\0`);
    if (ledger.missing) hash.update("ledger\0missing\0");
    const executionPlanTarget = kind === "plan-execution" ? prepared.packet.logical_files.find(
      (file) => hasExecutionPlanDeliveryChecklist(file.content)
    ) : void 0;
    const executionPlanFingerprint = executionPlanTarget === void 0 ? void 0 : executionPlanReviewIdentity(executionPlanTarget.content, cwd);
    for (const [section, files] of [
      ["targets", prepared.packet.logical_files],
      ["context", prepared.packet.context_files ?? []]
    ]) {
      hash.update(`${section}\0${files.length}\0`);
      for (const file of files) {
        hash.update(file.path);
        hash.update("\0");
        hash.update(
          reviewFingerprintContent(
            section,
            file.path,
            file.content,
            executionPlanTarget?.path,
            executionPlanFingerprint
          )
        );
        hash.update("\0");
      }
    }
    return { fingerprint: hash.digest("hex"), excludedTargets: prepared.excludedTargets };
  } finally {
    prepared.cleanup();
  }
}
function fingerprint(cwd, kind, targets, context = [], execution) {
  return reviewIdentity(cwd, kind, targets, context, execution).fingerprint;
}
function reviewFingerprintContent(section, path, content, executionPlanTargetPath, executionPlanFingerprint) {
  if (section === "targets" && path === executionPlanTargetPath && executionPlanFingerprint !== void 0) {
    return executionPlanFingerprint;
  }
  return content;
}
function pathEscapes(root, candidate) {
  const relative = nodePath4.relative(root, candidate);
  return relative === ".." || relative.startsWith(`..${nodePath4.sep}`) || nodePath4.isAbsolute(relative);
}
function writeJob(cwd, record) {
  const secured = withRecordIntegrity(cwd, record);
  if (!isReviewJobRecord(secured)) throw new Error("invalid review job record");
  const directory = jobsDirectory(cwd);
  mkdirSync3(directory, { recursive: true, mode: 448 });
  const destination = jobPath(cwd, secured.id);
  const temporary = `${destination}.${process.pid}.tmp`;
  writeFileSync3(temporary, `${JSON.stringify(secured)}
`, { mode: 384 });
  renameSync2(temporary, destination);
  return secured;
}
function withJobLock(cwd, id, operation) {
  return withFileLock(`${jobPath(cwd, id)}.lock`, operation);
}
function withFileLock(lock, operation) {
  const deadline = Date.now() + JOB_LOCK_WAIT_MS;
  let descriptor;
  while (descriptor === void 0) {
    try {
      descriptor = openSync3(lock, "wx", 384);
      try {
        writeFileSync3(descriptor, String(process.pid));
      } catch (error) {
        closeSync3(descriptor);
        descriptor = void 0;
        try {
          unlinkSync(lock);
        } catch {
        }
        throw error;
      }
    } catch (error) {
      if (!isFileExistsError(error) || Date.now() >= deadline) throw error;
      recoverStaleLock(lock);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }
  }
  try {
    return operation();
  } finally {
    const ownedLock = fstatSync3(descriptor);
    closeSync3(descriptor);
    try {
      const currentLock = statSync(lock);
      if (currentLock.dev === ownedLock.dev && currentLock.ino === ownedLock.ino) unlinkSync(lock);
    } catch {
    }
  }
}
function recoverStaleLock(lock) {
  try {
    const inspected = statSync(lock);
    const owner = Number(readFileSync2(lock, "utf8"));
    const invalidOwnerIsOld = !isProcessId(owner) && Date.now() - statSync(lock).mtimeMs >= JOB_LOCK_WAIT_MS;
    if (isProcessId(owner) && !processExists(owner) || invalidOwnerIsOld) {
      const current = statSync(lock);
      if (current.dev === inspected.dev && current.ino === inspected.ino) unlinkSync(lock);
    }
  } catch {
  }
}
function isFileExistsError(error) {
  return error instanceof Error && "code" in error && error.code === "EEXIST";
}
function updateActiveJob(cwd, id, update) {
  return withJobLock(cwd, id, () => {
    const latest = readJob(cwd, id);
    if (latest.state !== "launching" && latest.state !== "running") return latest;
    const next = update(latest);
    return writeJob(cwd, next);
  });
}
function isReviewJobRecord(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value;
  return hasReviewJobIdentity(candidate) && hasReviewJobLifecycle(candidate);
}
function hasReviewJobIdentity(candidate) {
  const hasStrings = ["id", "source_fingerprint", "started_at", "updated_at"].every(
    (key) => typeof candidate[key] === "string"
  );
  return candidate.schema_version === 1 && hasStrings && isStringArray(candidate.targets) && isOptional(candidate.context, isStringArray) && isOptional(
    candidate.retry_of,
    (value) => typeof value === "string" && isJobId(value) && value !== candidate.id
  ) && isOptional(candidate.authentication_bindings, validAuthenticationBindings) && (candidate.kind === "executable-red" ? isRedExecutionRequest(candidate.execution) : candidate.execution === void 0) && isOptional(
    candidate.deadline_at,
    (value) => typeof value === "string" && Number.isFinite(Date.parse(value))
  ) && isReviewKind(candidate.kind);
}
function validAuthenticationBindings(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) && Object.entries(value).every(
    ([reviewer, digest2]) => ["claude", "codex"].includes(reviewer) && typeof digest2 === "string" && /^[a-f\d]{64}$/u.test(digest2)
  );
}
function isRedExecutionRequest(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value;
  return ["scenario", "ledger", "cwd", "expectedFailure"].every(
    (key) => typeof candidate[key] === "string" && candidate[key].length > 0
  ) && Array.isArray(candidate.argv) && candidate.argv.length > 0 && candidate.argv.every((argument) => typeof argument === "string") && ["pure-contract", "simulated-host", "local-live-host", "external-live-host"].includes(
    candidate.evidenceClass
  ) && Number.isSafeInteger(candidate.timeoutMs) && candidate.timeoutMs > 0;
}
function hasReviewJobLifecycle(candidate) {
  if (!isJobState(candidate.state)) return false;
  switch (candidate.state) {
    case "launching":
    case "running": {
      return isProcessId(candidate.pid) && candidate.result === void 0;
    }
    case "completed": {
      return isCoherentTerminalResult(candidate, false);
    }
    case "failed": {
      return isCoherentTerminalResult(candidate, true);
    }
    case "canceled": {
      return candidate.result === void 0;
    }
  }
}
function isCoherentTerminalResult(candidate, failed) {
  return isCliResult(candidate.result) && candidate.result.state === "failed" === failed && typeof candidate.integrity === "string";
}
function isOptional(value, predicate) {
  return value === void 0 || predicate(value);
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
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value;
  const state = candidate.state;
  const effects = candidate.effects;
  const data = candidate.data;
  const expectedOk = state !== "failed";
  const expectedChanged = state === "changed";
  const hasHeader = candidate.schemaVersion === 1 && candidate.ok === expectedOk && candidate.changed === expectedChanged;
  const hasState = ["healthy", "changed", "action_required", "failed"].includes(String(state));
  const hasArrays = ["findings", "errors", "recovery", "nextActions"].every(
    (key) => Array.isArray(candidate[key])
  );
  return hasHeader && hasState && hasArrays && isEffects(effects) && isReviewResultData(data, state);
}
function isEffects(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return ["files", "packages", "configuration", "network", "destructive"].every(
    (key) => Array.isArray(value[key])
  );
}
function isReviewResultData(value, state) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const data = value;
  if (!["review run", "review status"].includes(String(data.command))) return false;
  if (typeof data.status !== "string") return false;
  if (data.command === "review status") return ["failed", "stale"].includes(data.status);
  if (data.status !== "approved" && data.status !== "changes_requested")
    return ["blocked", "existing_route", "failed", "stale"].includes(data.status);
  return isCompletedReviewData(data, state);
}
function isCompletedReviewData(data, state) {
  const output = data.reviewer_output;
  if (typeof output !== "object" || output === null || Array.isArray(output)) return false;
  const reviewer = output;
  const verdict = data.status === "approved" ? "approve" : "request_changes";
  return hasReviewerIdentity(reviewer) && reviewer.verdict === verdict && typeof reviewer.summary === "string" && Array.isArray(reviewer.findings) && state === (data.status === "approved" ? "healthy" : "action_required");
}
function hasReviewerIdentity(reviewer) {
  return typeof reviewer.dispatch_id === "string" && reviewer.dispatch_id.length > 0 && ["claude", "codex", "opencode"].includes(String(reviewer.reviewer_agent));
}
function readJob(cwd, id, readOnly = false) {
  const parsed = JSON.parse(readFileSync2(jobPath(cwd, id), "utf8"));
  if (!isReviewJobRecord(parsed) || parsed.id !== id || !hasValidIntegrity(cwd, parsed, readOnly))
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
  if (/^[\w./-]+$/u.test(value)) return value;
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
function currentResult(cwd, record, readOnly = false) {
  if (isActiveJobPastDeadline(record))
    return readOnly ? failedJobResult(record, {
      code: "REVIEW_WORKER_TIMED_OUT",
      message: "The background review worker exceeded its deadline before recording a result."
    }) : failTimedOutJob(cwd, record);
  if (record.state === "launching") {
    if (record.pid !== void 0 && processExists(record.pid)) return pendingResult(record);
    return readOnly ? failedJobResult(record, {
      code: "REVIEW_WORKER_EXITED",
      message: "The background review worker exited before recording a result."
    }) : failExitedJob(cwd, record);
  }
  if (record.state === "running") {
    if (!readOnly && workerDefinitelyMismatches(record)) return failExitedJob(cwd, record);
    return pendingResult(record);
  }
  return terminalResult(cwd, record, readOnly);
}
function isActiveJobPastDeadline(record) {
  if (record.state !== "launching" && record.state !== "running") return false;
  const deadline = record.deadline_at === void 0 ? NaN : Date.parse(record.deadline_at);
  return Number.isFinite(deadline) && Date.now() >= deadline;
}
function failedJobResult(record, error) {
  return createResult({
    state: "failed",
    errors: [{ code: error.code, message: error.message, retryable: true }],
    data: { command: "review status", status: "failed", review_id: record.id }
  });
}
function failActiveJob(cwd, record, error) {
  const failed = failedJobResult(record, error);
  const latest = updateActiveJob(cwd, record.id, (current) => ({
    ...current,
    state: "failed",
    result: failed,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  }));
  return latest.state === "failed" && latest.result === failed ? failed : terminalResult(cwd, latest);
}
function failTimedOutJob(cwd, record) {
  if (record.pid !== void 0 && inspectReviewWorker(record.pid, record.id) === "match") {
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
function terminalResult(cwd, record, readOnly = false) {
  if (!hasValidIntegrity(cwd, record, readOnly)) return invalidJobResult(record.id);
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
    const current = reviewIdentity(
      cwd,
      record.kind,
      record.targets,
      record.context,
      record.execution,
      readOnly
    );
    if (current.fingerprint !== record.source_fingerprint) return staleResult(record);
    if (record.result !== void 0)
      return withReviewProvenance(cwd, record, record.result, current.excludedTargets);
  } catch {
    return staleResult(record);
  }
  return createResult({
    state: "failed",
    errors: [
      { code: "REVIEW_JOB_INVALID", message: "The review job has no result.", retryable: true }
    ],
    data: { command: "review status", status: "failed", review_id: record.id }
  });
}
function effectiveReviewTargets(cwd, record) {
  const data = record.result?.data;
  if (typeof data !== "object" || data === null || Array.isArray(data)) return record.targets;
  const excluded = data.excluded_targets;
  if (excluded === void 0) return record.targets;
  if (!Array.isArray(excluded) || excluded.some((target) => typeof target !== "string"))
    return void 0;
  const excludedPaths = new Set(excluded);
  const root = realpathSync3.native(cwd);
  return record.targets.filter((target) => {
    const relative = nodePath4.relative(root, nodePath4.resolve(root, target));
    return !excludedPaths.has(toReviewPath(relative));
  });
}
function verifiedExcludedTargets(record, current) {
  const data = record.result?.data;
  const recorded = data?.excluded_targets;
  if (!Array.isArray(recorded) || recorded.some((target) => typeof target !== "string")) return [];
  if (recorded.length === 0) return [];
  const recordedPaths = new Set(recorded);
  return current.filter((target) => recordedPaths.has(target));
}
function withReviewProvenance(cwd, record, result, currentExclusions) {
  const data = typeof result.data === "object" && result.data !== null && !Array.isArray(result.data) ? result.data : {};
  return {
    ...result,
    data: {
      ...data,
      review_id: record.id,
      review_kind: record.kind,
      review_targets: effectiveReviewTargets(cwd, record) ?? [],
      review_excluded_targets: verifiedExcludedTargets(record, currentExclusions),
      ...authenticationReviewer(record) !== void 0 && { authentication_continuation: true },
      ...record.retry_of !== void 0 && { retry_of: record.retry_of }
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
  if (process.env.NODE_ENV === "test" && testOverride !== void 0) return testOverride;
  if (process.platform !== "win32") return `/bin/${name}`;
  const systemRoot = process.env.SystemRoot ?? String.raw`C:\Windows`;
  return name === "powershell.exe" ? nodePath4.join(systemRoot, "System32", "WindowsPowerShell", "v1.0", name) : nodePath4.join(systemRoot, "System32", name);
}
function configuredCourtesyWait() {
  const raw = process.env.SAFEWORD_REVIEW_FOREGROUND_MS;
  const value = raw === void 0 || raw.trim() === "" ? NaN : Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.min(value, 54e4) : COURTESY_WAIT_MS;
}
function cliEntrypoint() {
  const configured = process.env.SAFEWORD_CLI_ENTRYPOINT;
  if (configured !== void 0 && process.env.NODE_ENV === "test") return configured;
  const invoked = process.argv[1];
  if (invoked !== void 0 && /^cli\.(?:js|ts)$/u.test(nodePath4.basename(invoked))) return invoked;
  const bundled = nodePath4.join(import.meta.dirname, "cli.js");
  if (existsSync(bundled)) return bundled;
  const developmentBuild = nodePath4.resolve(import.meta.dirname, "../../dist/cli.js");
  if (existsSync(developmentBuild)) return developmentBuild;
  throw new Error("Safeword CLI entrypoint is unavailable");
}
function launchReviewWorker(input) {
  return spawn(
    process.execPath,
    [
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
    ],
    {
      cwd: input.cwd,
      env: {
        ...process.env,
        SAFEWORD_REVIEW_JOB_ID: input.id,
        SAFEWORD_REVIEW_WORKER: "1",
        ...input.managedProgress && { SAFEWORD_REVIEW_PROGRESS: "1" }
      },
      detached: true,
      // Managed progress is relayed only while the foreground command owns it. Inheriting
      // stderr would keep a caller's capture pipe open for the detached worker's lifetime.
      stdio: input.managedProgress ? ["ignore", "ignore", "pipe"] : "ignore"
    }
  );
}
function closeNoManagedProgress() {
  return;
}
function containManagedRelayError() {
}
function relayManagedWorkerStderr(child, enabled) {
  const stderr = child.stderr;
  if (!enabled || stderr === null) return closeNoManagedProgress;
  const writeBytes = createBestEffortByteSink(
    (buffer, offset, length) => writeSync(2, buffer, offset, length)
  );
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
  if (managedProgress) return;
  progress?.start("Running the independent review in the background\u2026");
  progress?.heartbeat?.("Still waiting for the independent review\u2026");
}
function checkAuthenticationAbort(retry) {
  retry?.signal.throwIfAborted();
}
function authenticationParentForRequest(input, context) {
  if (input.authenticationRetry === void 0) return void 0;
  const parent = verifiedAuthenticationParent(input.cwd, input.authenticationRetry);
  if (input.kind !== parent.kind || input.execution !== void 0 || JSON.stringify(input.targets) !== JSON.stringify(parent.targets) || JSON.stringify(context) !== JSON.stringify(parent.context ?? []))
    throw new Error("The review execution context changed. Retry manually.");
  checkAuthenticationAbort(input.authenticationRetry);
  return parent;
}
function existingAuthenticationRetry(cwd, parent) {
  const id = authenticationRetryId(parent.id);
  if (existsSync(jobPath(cwd, id))) {
    const child = readJob(cwd, id, true);
    if (!linkedAuthenticationRetry(parent, child))
      throw new Error("The linked authentication retry is invalid. Retry manually.");
    return child;
  }
  if (runningJob(cwd, parent.kind, parent.source_fingerprint) !== void 0)
    throw new Error("Another review of this request is active. Collect it before retrying.");
  return void 0;
}
function bindingsForRequest(input, parent) {
  if (parent !== void 0) return parent.authentication_bindings;
  return AUTHENTICATION_REVIEW_KINDS.has(input.kind) ? captureAuthenticationBindings(input.cwd) : void 0;
}
async function startReviewJob(input) {
  checkAuthenticationAbort(input.authenticationRetry);
  const context = input.context ?? [];
  const sourceFingerprint = fingerprint(
    input.cwd,
    input.kind,
    input.targets,
    context,
    input.execution
  );
  mkdirSync3(jobsDirectory(input.cwd), { recursive: true, mode: 448 });
  const reserved = withFileLock(nodePath4.join(jobsDirectory(input.cwd), "start.lock"), () => {
    const parent = authenticationParentForRequest(input, context);
    const linked = parent === void 0 ? void 0 : existingAuthenticationRetry(input.cwd, parent);
    if (linked !== void 0) return { existing: true, record: linked };
    const existing = runningJob(input.cwd, input.kind, sourceFingerprint) ?? (input.kind === "executable-red" ? reusableApprovedExecutableRedJob(input.cwd, sourceFingerprint) : void 0);
    if (existing !== void 0) return { existing: true, record: existing };
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const record2 = {
      schema_version: 1,
      id: parent === void 0 ? randomUUID2() : authenticationRetryId(parent.id),
      state: "launching",
      kind: input.kind,
      targets: input.targets,
      context,
      execution: input.execution,
      source_fingerprint: parent?.source_fingerprint ?? sourceFingerprint,
      started_at: now,
      updated_at: now,
      deadline_at: new Date(Date.now() + reviewWorkerRunBoundMs()).toISOString(),
      pid: process.pid,
      authentication_bindings: bindingsForRequest(input, parent),
      retry_of: parent?.id
    };
    writeJob(input.cwd, record2);
    return { existing: false, record: record2 };
  });
  if (reserved.existing) return currentResult(input.cwd, reserved.record);
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
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }));
    } catch {
    }
  });
  child.unref();
  try {
    if (child.pid === void 0) {
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
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      });
      return failed;
    }
    updateActiveJob(input.cwd, id, (current) => ({
      ...current,
      state: "running",
      pid: child.pid,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
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
      if (latest.state !== "running") return currentResult(input.cwd, latest);
      const now = Date.now();
      if (now >= nextInspectionAt) {
        if (workerDefinitelyMismatches(latest)) return failExitedJob(input.cwd, latest);
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
  return record.pid !== void 0 && inspectReviewWorker(record.pid, record.id) === "mismatch";
}
function terminateUnactivatedWorker(record, pid) {
  if (record.state !== "completed" && record.state !== "failed" && inspectReviewWorker(pid, record.id) === "match")
    terminateReviewWorker(pid);
}
function terminateReviewWorker(pid) {
  if (process.platform === "win32") {
    spawnSync2(processTool("taskkill"), ["/PID", String(pid), "/T", "/F"], {
      stdio: "ignore",
      timeout: 5e3,
      windowsHide: true
    });
    return;
  }
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
  }
}
function completeReviewJob(cwd, id, result, activeOnly = false) {
  withJobLock(cwd, id, () => {
    const record = readJob(cwd, id);
    if (record.state === "completed") {
      if (activeOnly) return;
      const invalidated = createResult({
        state: "failed",
        errors: [
          {
            code: "REVIEW_JOB_PREEMPTED",
            message: "The review record completed before its worker published the result.",
            retryable: true
          }
        ],
        data: { command: "review run", status: "failed", review_id: id }
      });
      writeJob(cwd, {
        ...record,
        state: "failed",
        result: invalidated,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      });
      return;
    }
    if (record.state !== "launching" && record.state !== "running") return;
    const completed = {
      ...record,
      state: result.state === "failed" ? "failed" : "completed",
      result,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    writeJob(cwd, completed);
  });
}
function reviewJobWorkerInput(cwd, id) {
  const record = withJobLock(cwd, id, () => {
    const current = readJob(cwd, id);
    if (current.state !== "launching" && current.state !== "running")
      throw new Error("review job is not active");
    const claimed = {
      ...current,
      state: "running",
      pid: process.pid,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    writeJob(cwd, claimed);
    return claimed;
  });
  return {
    kind: record.kind,
    targets: record.targets,
    context: record.context ?? [],
    execution: record.execution,
    sourceFingerprint: record.source_fingerprint,
    continuation: workerAuthenticationContinuation(cwd, record)
  };
}
function authenticationRetryModel(parent) {
  const data = parent.result?.data;
  if (data === void 0) throw new Error("The authentication retry has no route evidence.");
  const primaryModel = data.preferred_model_failure === void 0 ? data.preferred_model : void 0;
  const model = data.alternate_model_failure === "not_authenticated" ? data.alternate_model : primaryModel;
  if (model === void 0) return void 0;
  if (typeof model !== "string" || !MODEL_NAME.test(model))
    throw new Error("The authentication retry model is invalid.");
  return model;
}
function workerAuthenticationContinuation(cwd, record) {
  if (record.retry_of === void 0) return void 0;
  const parent = readJob(cwd, record.retry_of, true);
  const reviewer = authenticationReviewer(parent);
  if (reviewer === void 0 || !linkedAuthenticationRetry(parent, record))
    throw new Error("The authentication retry is invalid.");
  const context = authenticationContext(cwd, reviewer);
  const validate = () => {
    const currentChild = readJob(cwd, record.id, true);
    const currentParent = readJob(cwd, parent.id, true);
    if (!linkedAuthenticationRetry(currentParent, currentChild))
      throw new Error("The authentication retry is invalid.");
    const currentContext = authenticationContext(cwd, reviewer);
    assertReviewAuthenticationContext(cwd, parent.id, reviewer, currentContext);
    assertReviewAuthenticationContext(cwd, parent.id, reviewer, context);
  };
  validate();
  return { reviewer, model: authenticationRetryModel(parent), ...context, validate };
}
function latestJobId(cwd) {
  const directory = jobsDirectory(cwd);
  if (!existsSync(directory)) return void 0;
  return readdirSync3(directory).flatMap((name) => {
    if (!/^[a-f\d-]{36}\.json$/u.test(name)) return [];
    try {
      return [{ record: readJob(cwd, name.slice(0, -5)) }];
    } catch {
      return [];
    }
  }).toSorted(
    (left, right) => right.record.started_at < left.record.started_at ? -1 : Number(right.record.started_at > left.record.started_at)
  )[0]?.record.id;
}
function routeProofFromValue(value, actualReviewer, observedAt) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return void 0;
  const route = value;
  if (typeof route.reviewer !== "string" || !["attempted", "unavailable"].includes(String(route.status)))
    return void 0;
  const model = typeof route.model === "string" ? route.model : void 0;
  const failure = typeof route.failure === "string" ? route.failure : void 0;
  const proven = failure === void 0 && actualReviewer === route.reviewer;
  if (!proven && failure === void 0) return void 0;
  return {
    reviewer: route.reviewer,
    ...model !== void 0 && { model },
    runtime_default: model === void 0,
    proof: proven ? "proven" : "known_failure",
    ...failure !== void 0 && { failure },
    observed_at: observedAt
  };
}
function routeProofsFromRecord(record) {
  const data = record.result?.data;
  if (typeof data !== "object" || data === null || Array.isArray(data)) return [];
  const resultData = data;
  const routes = resultData.review_routes;
  return Array.isArray(routes) ? routes.flatMap((value) => {
    const proof = routeProofFromValue(value, resultData.actual_reviewer, record.updated_at);
    return proof === void 0 ? [] : [proof];
  }) : [];
}
function readReviewRouteProofs(cwd) {
  const directory = jobsDirectory(cwd);
  if (!existsSync(directory) || !existsSync(integrityKeyPath())) return [];
  let entries;
  try {
    entries = readdirSync3(directory);
  } catch {
    return [];
  }
  const records = entries.flatMap((name) => {
    if (!/^[a-f\d-]{36}\.json$/u.test(name)) return [];
    try {
      return [readJob(cwd, name.slice(0, -5))];
    } catch {
      return [];
    }
  }).toSorted((left, right) => right.updated_at.localeCompare(left.updated_at));
  const proofs = /* @__PURE__ */ new Map();
  for (const record of records) {
    for (const proof of routeProofsFromRecord(record)) {
      const key = `${proof.reviewer}\0${proof.model ?? "<runtime-default>"}`;
      if (!proofs.has(key)) proofs.set(key, proof);
    }
  }
  return proofs.values().toArray();
}
function runningJob(cwd, kind, sourceFingerprint) {
  const directory = jobsDirectory(cwd);
  if (!existsSync(directory)) return void 0;
  for (const name of readdirSync3(directory)) {
    if (!/^[a-f\d-]{36}\.json$/u.test(name)) continue;
    try {
      const record = readJob(cwd, name.slice(0, -5));
      if (isActiveReviewJob(record) && record.kind === kind && record.source_fingerprint === sourceFingerprint) {
        return record;
      }
    } catch {
    }
  }
  return void 0;
}
function reusableApprovedExecutableRedJob(cwd, sourceFingerprint) {
  const directory = jobsDirectory(cwd);
  if (!existsSync(directory)) return void 0;
  for (const name of readdirSync3(directory)) {
    if (!/^[a-f\d-]{36}\.json$/u.test(name)) continue;
    try {
      const record = readJob(cwd, name.slice(0, -5));
      if (record.kind === "executable-red" && record.source_fingerprint === sourceFingerprint && approvedCrossAgentReceipt(record))
        return record;
    } catch {
    }
  }
  return void 0;
}
function hasIndependentVerdict(data) {
  const reviewerOutput = data?.reviewer_output;
  const actualReviewer = data?.actual_reviewer;
  return [
    data?.status === "approved" || data?.status === "changes_requested",
    data?.independence === "cross-agent",
    typeof data?.author_agent === "string",
    ["claude", "codex", "opencode"].includes(actualReviewer),
    data?.author_agent !== actualReviewer,
    reviewerOutput?.reviewer_agent === actualReviewer
  ].every(Boolean);
}
function hasIndependentApproval(data) {
  return data?.status === "approved" && hasIndependentVerdict(data);
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
  return record.state === "completed" && (record.pid === void 0 || inspectReviewWorker(record.pid, record.id) !== "match") && hasIndependentApproval(data) && hasFailingExecutionAttestation(attestation, record.source_fingerprint);
}
function executableRedJobsForScenario(cwd, scenario, ledger) {
  const directory = jobsDirectory(cwd);
  if (!existsSync(directory)) return [];
  return readdirSync3(directory).flatMap((name) => {
    if (!/^[a-f\d-]{36}\.json$/u.test(name)) return [];
    try {
      const record = readJob(cwd, name.slice(0, -5));
      return record.kind === "executable-red" && record.execution?.scenario === scenario && nodePath4.resolve(cwd, record.execution.ledger) === nodePath4.resolve(cwd, ledger) ? [record] : [];
    } catch {
      return [];
    }
  });
}
function hasCurrentFingerprint(cwd, record) {
  try {
    return fingerprint(cwd, record.kind, record.targets, record.context, record.execution) === record.source_fingerprint;
  } catch {
    return false;
  }
}
function approvedRetrospectiveReview(cwd, id, kind) {
  try {
    const record = readJob(cwd, id);
    const data = record.result?.data;
    return record.kind === kind && record.state === "completed" && hasCurrentFingerprint(cwd, record) && hasIndependentApproval(data) ? effectiveReviewTargets(cwd, record) : void 0;
  } catch {
    return void 0;
  }
}
function approvedExecutableRedGateResult(record, scenario, ledger) {
  return createResult({
    state: "healthy",
    findings: [
      {
        code: "EXECUTABLE_RED_GATE_APPROVED",
        message: `GREEN is authorized for ${scenario} by a fresh independent executable RED review.`,
        severity: "info"
      }
    ],
    data: {
      command: "review gate executable-red",
      status: "approved",
      review_id: record.id,
      scenario,
      ledger
    }
  });
}
function executableRedGate(cwd, scenario, ledger) {
  const matching = executableRedJobsForScenario(cwd, scenario, ledger);
  const current = matching.filter((record) => hasCurrentFingerprint(cwd, record));
  const approved = current.find((record) => approvedCrossAgentReceipt(record));
  if (approved !== void 0) return approvedExecutableRedGateResult(approved, scenario, ledger);
  let reason = matching.length > 0 ? `The current executable RED review for ${scenario} is not an approved independent receipt.` : `No trusted executable RED receipt matches ${scenario}.`;
  reason = matching.length > 0 && current.length === 0 ? `The executable RED approval for ${scenario} is stale because its declared proof inputs changed.` : reason;
  return createResult({
    state: "action_required",
    findings: [{ code: "EXECUTABLE_RED_GATE_BLOCKED", message: reason, severity: "warning" }],
    data: { command: "review gate executable-red", status: "blocked", scenario, ledger }
  });
}
function isActiveReviewJob(record) {
  if (record.pid === void 0) return false;
  if (record.state === "launching") return processExists(record.pid);
  return record.state === "running" && inspectReviewWorker(record.pid, record.id) !== "mismatch";
}
function followAuthenticationRetry(cwd, parent, readOnly) {
  if (authenticationReviewer(parent) === void 0) return parent;
  const id = authenticationRetryId(parent.id);
  if (!existsSync(jobPath(cwd, id))) return parent;
  const child = readJob(cwd, id, readOnly);
  return linkedAuthenticationRetry(parent, child) ? child : void 0;
}
function requestedReviewId(cwd, requestedId) {
  try {
    return requestedId ?? latestJobId(cwd);
  } catch {
    return requestedId;
  }
}
function reviewJobStatus(cwd, requestedId, readOnly = false) {
  const id = requestedReviewId(cwd, requestedId);
  if (id === void 0) {
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
    record = readJob(cwd, id, readOnly);
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
    const linked = followAuthenticationRetry(cwd, record, readOnly);
    if (linked === void 0) return invalidJobResult(record.id);
    record = linked;
    const result = currentResult(cwd, record, readOnly);
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
function cancelReviewJob(cwd, requestedId) {
  try {
    const id = requestedId ?? latestJobId(cwd);
    if (id === void 0) return asCancelResult(reviewJobStatus(cwd, id));
    const canceled = withJobLock(cwd, id, () => {
      const record = readJob(cwd, id);
      if (record.state !== "launching" && record.state !== "running") return record;
      if (record.state === "running" && record.pid !== void 0 && inspectReviewWorker(record.pid, record.id) === "match") {
        terminateReviewWorker(record.pid);
      }
      const next = {
        ...record,
        state: "canceled",
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      return writeJob(cwd, next);
    });
    return asCancelResult(currentResult(cwd, canceled));
  } catch {
    return asCancelResult(reviewJobStatus(cwd, requestedId));
  }
}
function asCancelResult(result) {
  return {
    ...result,
    effects: { ...result.effects, network: [] },
    data: { ...result.data, command: "review cancel" }
  };
}
function isJobId(value) {
  return /^[a-f\d-]{36}$/u.test(value);
}
function inspectReviewWorker(pid, id) {
  const inspected = process.platform === "win32" ? spawnSync2(
    processTool("powershell.exe"),
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `(Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}").CommandLine`
    ],
    { encoding: "utf8", timeout: 1e3, windowsHide: true }
  ) : spawnSync2(processTool("ps"), ["-ww", "-p", String(pid), "-o", "command="], {
    encoding: "utf8",
    timeout: 1e3
  });
  if (inspected.status !== 0) return processExists(pid) ? "unavailable" : "mismatch";
  return /\breview run\b/u.test(inspected.stdout) && inspected.stdout.includes(`--worker-job-id ${id}`) ? "match" : "mismatch";
}
var ReviewAuthenticationContextChangedError, AUTHENTICATION_REVIEW_KINDS, COURTESY_WAIT_MS, POLL_INTERVAL_MS, WORKER_INSPECTION_INTERVAL_MS, JOB_LOCK_WAIT_MS, DELIVERY_CHECKLIST_MARKER, DELIVERY_CHECKLIST_COLUMNS, ORDINARY_PROGRESS_DISPOSITIONS;
var init_job = __esm({
  "review/job.ts"() {
    "use strict";
    init_policy();
    init_result();
    init_command();
    init_contract();
    init_environment();
    init_packet();
    init_preferences();
    init_route_config();
    init_runtime();
    ReviewAuthenticationContextChangedError = class extends Error {
      name = "ReviewAuthenticationContextChangedError";
    };
    AUTHENTICATION_REVIEW_KINDS = /* @__PURE__ */ new Set([
      "quality-review",
      "scenario-gate",
      "plan-implementation"
    ]);
    COURTESY_WAIT_MS = 75e3;
    POLL_INTERVAL_MS = 100;
    WORKER_INSPECTION_INTERVAL_MS = 1e3;
    JOB_LOCK_WAIT_MS = 2e3;
    DELIVERY_CHECKLIST_MARKER = "<!-- safeword:delivery-checklist:v1 -->";
    DELIVERY_CHECKLIST_COLUMNS = 9;
    ORDINARY_PROGRESS_DISPOSITIONS = /* @__PURE__ */ new Set(["open", "complete"]);
  }
});

// codex-plugin/review-mcp.ts
init_job();
import { lstatSync as lstatSync3, realpathSync as realpathSync4, statSync as statSync2 } from "node:fs";
import nodePath7 from "node:path";
import readline from "node:readline";

// codex-plugin/review-login-ui.ts
var REVIEW_LOGIN_URI = "ui://safeword/reviewer-login.html";
var REVIEW_LOGIN_HTML = `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { font: 14px system-ui, sans-serif; margin: 0; padding: 16px; color: light-dark(#171717,#f5f5f5); color-scheme: light dark; background: light-dark(#fff,#171717); }
  h1 { font-size: 18px; margin: 0 0 8px; }
  p { margin: 8px 0; }
  button { border: 0; border-radius: 8px; padding: 9px 14px; cursor: pointer; background: #2457cf; color: white; }
  code { user-select: all; font-size: 16px; }
</style>
<h1>Sign in to finish the independent review</h1>
<p id="reviewer">Waiting for sign-in details\u2026</p>
<button id="open" hidden>Open sign-in page</button>
<p id="code" hidden></p>
<p id="help"></p>
<script>
  let nextId = 1;
  let loginUrl;
  let opened = false;
  const open = document.getElementById('open');
  function openLogin() {
    if (loginUrl) window.parent.postMessage({ jsonrpc: '2.0', id: nextId++, method: 'ui/open-link', params: { url: loginUrl } }, '*');
  }
  function render(value) {
    if (!value || typeof value.auth_url !== 'string') return;
    loginUrl = value.auth_url;
    document.getElementById('reviewer').textContent = 'Sign in to ' + value.reviewer + ' to resume this review.';
    open.hidden = false;
    const code = document.getElementById('code');
    code.hidden = typeof value.device_code !== 'string';
    if (!code.hidden) {
      code.textContent = 'Enter this code on the sign-in page: ';
      const token = document.createElement('code');
      token.textContent = value.device_code;
      code.append(token);
    }
    document.getElementById('help').textContent = value.automatic_resume_allowed
      ? 'Complete sign-in. This review resumes automatically while connected; you can close this panel.'
      : value.reviewer === 'claude'
      ? 'Complete Claude sign-in in your browser, then retry the review.'
      : 'Return here after sign-in, then retry the same review.';
    if (!opened) {
      opened = true;
      if (value.automatic_open_allowed && !value.browser_launch_requested) openLogin();
    }
  }
  open.addEventListener('click', openLogin);
  window.addEventListener('message', event => {
    if (event.source !== window.parent || event.data?.jsonrpc !== '2.0') return;
    if (event.data.id === 1 && event.data.result) {
      window.parent.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/initialized', params: {} }, '*');
      return;
    }
    if (event.data.method === 'ui/notifications/tool-result') {
      const result = event.data.params;
      let value = result?.structuredContent;
      if (!value && typeof result?.content?.[0]?.text === 'string') {
        try { value = JSON.parse(result.content[0].text); } catch { return; }
      }
      render(value);
    }
  });
  window.parent.postMessage({ jsonrpc: '2.0', id: nextId++, method: 'ui/initialize', params: { protocolVersion: '2026-01-26', appInfo: { name: 'safeword-review-login', version: '1' }, appCapabilities: { availableDisplayModes: ['inline'] } } }, '*');
</script></html>`;

// codex-plugin/reviewer-browser.ts
import { spawn as spawn2 } from "node:child_process";
import nodePath5 from "node:path";
var SPAWN_OPTIONS = { shell: false, stdio: "ignore", detached: true };
function browserOpenerCommand(url, platform = process.platform) {
  if (platform === "darwin")
    return { command: "/usr/bin/open", args: [url], options: SPAWN_OPTIONS };
  if (platform === "linux")
    return { command: "/usr/bin/xdg-open", args: [url], options: SPAWN_OPTIONS };
  if (platform === "win32") {
    const windowsRoot = process.env.SystemRoot ?? String.raw`C:\Windows`;
    return {
      command: nodePath5.win32.join(windowsRoot, "System32", "rundll32.exe"),
      args: ["url.dll,FileProtocolHandler", url],
      options: SPAWN_OPTIONS
    };
  }
  return void 0;
}
async function requestBrowserOpen(url) {
  const opener = browserOpenerCommand(url);
  if (opener === void 0) return false;
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn2(opener.command, opener.args, opener.options);
    } catch {
      resolve(false);
      return;
    }
    child.once("spawn", () => {
      child.unref();
      resolve(true);
    });
    child.once("error", () => {
      resolve(false);
    });
  });
}

// codex-plugin/reviewer-login.ts
init_environment();
init_runtime();
import { spawn as spawn3 } from "node:child_process";
import { mkdtempSync as mkdtempSync3, rmSync as rmSync3 } from "node:fs";
import { homedir as homedir3, tmpdir as tmpdir3 } from "node:os";
import nodePath6 from "node:path";
var outcomes = /* @__PURE__ */ new Map();
function reviewerLoginOutcome(reviewKey) {
  return outcomes.get(reviewKey);
}
function recordOutcome(reviewKey, outcome) {
  outcomes.delete(reviewKey);
  outcomes.set(reviewKey, outcome);
  if (outcomes.size > 100) {
    const oldest = outcomes.keys().next().value;
    if (oldest !== void 0) outcomes.delete(oldest);
  }
}
var sessions = /* @__PURE__ */ new Map();
var LOGIN_TIMEOUT_MS = 3e4;
var SESSION_TIMEOUT_MS = 10 * 6e4;
var AUTH_CHECK_TIMEOUT_MS = 1e4;
function qualifyingAuthentication(reviewer, output, environment) {
  if (reviewer === "codex") return /^Logged in using ChatGPT\s*$/u.test(output.trim());
  try {
    const status = JSON.parse(output);
    if (status === null || typeof status !== "object") return false;
    const fields = status;
    const directory = environment.CLAUDE_CONFIG_DIR ?? nodePath6.join(environment.HOME ?? homedir3(), ".claude");
    return nodePath6.isAbsolute(directory) && fields.loggedIn === true && fields.authMethod === "claude.ai" && fields.configDirectory === directory;
  } catch {
    return false;
  }
}
function authenticationCheck(reviewer, context, cwd, signal, retain) {
  const args = reviewer === "claude" ? ["auth", "status", "--json"] : ["login", "status"];
  const child = spawn3(context.executable, args, {
    cwd,
    env: context.environment,
    stdio: ["pipe", "pipe", "pipe"],
    shell: false,
    detached: process.platform !== "win32"
  });
  retain(child);
  return new Promise((resolve) => {
    let output = "";
    let timedOut = false;
    const collect = (chunk) => {
      output = `${output}${chunk.toString()}`.slice(-16384);
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    const timeout = setTimeout(() => {
      timedOut = true;
      signalLogin(child, "SIGTERM");
      const force = setTimeout(() => {
        signalLogin(child, "SIGKILL");
      }, 2e3);
      force.unref();
    }, AUTH_CHECK_TIMEOUT_MS);
    timeout.unref();
    child.once("error", () => {
      clearTimeout(timeout);
      resolve(false);
    });
    child.once("close", (code) => {
      clearTimeout(timeout);
      resolve(
        !timedOut && !signal.aborted && code === 0 && qualifyingAuthentication(reviewer, output, context.environment)
      );
    });
  });
}
function parseReviewerLoginOutput(reviewer, output, complete = true) {
  const clean = output.replaceAll(/\u{1B}\[[\d;]*m/gu, "");
  const allowed = reviewer === "claude" ? ["claude.com", "platform.claude.com"] : ["auth.openai.com"];
  let url;
  let urlEnd = 0;
  for (const match2 of clean.matchAll(/https:\/\/[^\s<>"'\p{Cc}]+(?=[\s<>"'\p{Cc}])/gu)) {
    try {
      const candidate = new URL(match2[0]);
      if (allowed.includes(candidate.hostname)) {
        url = candidate;
        urlEnd = (match2.index ?? 0) + match2[0].length;
        break;
      }
    } catch {
    }
  }
  if (url === void 0 || url.href.length > 8e3) return void 0;
  if (reviewer === "claude") return { auth_url: url.href };
  const codeOutput = clean.slice(urlEnd);
  const match = /\b[A-Z\d]{4,5}-[A-Z\d]{4,5}\b/u.exec(codeOutput);
  if (!complete && match !== null && match.index + match[0].length === codeOutput.length)
    return void 0;
  const deviceCode = match?.[0];
  return deviceCode === void 0 ? void 0 : { auth_url: url.href, device_code: deviceCode };
}
function capturedReviewerLogin(reviewKey) {
  return sessions.get(reviewKey)?.login;
}
function cancelReviewerLogin(reviewKey) {
  const session = sessions.get(reviewKey);
  if (session === void 0) return;
  sessions.delete(reviewKey);
  session.stop();
}
function cancelAllReviewerLogins() {
  for (const key of sessions.keys()) cancelReviewerLogin(key);
}
function signalLogin(child, signal) {
  if (child.pid === void 0) return;
  try {
    if (process.platform === "win32") child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ESRCH")) throw error;
  }
}
async function startReviewerLogin(reviewKey, reviewer, untrustedRoot, options) {
  if (sessions.has(reviewKey))
    throw new Error("A reviewer login is already running for this review");
  const command = trustedReviewerExecutable(reviewer, untrustedRoot);
  const context = { executable: command, environment: reviewerEnvironment(reviewer) };
  options?.validateContext?.(context);
  outcomes.delete(reviewKey);
  const args = reviewer === "claude" ? ["auth", "login"] : ["login", "--device-auth"];
  const loginCwd = mkdtempSync3(nodePath6.join(tmpdir3(), "safeword-reviewer-login-"));
  let child;
  try {
    child = spawn3(command, args, {
      cwd: loginCwd,
      env: context.environment,
      stdio: ["pipe", "pipe", "pipe"],
      shell: false,
      detached: process.platform !== "win32"
    });
  } catch (error) {
    rmSync3(loginCwd, { recursive: true, force: true });
    throw error;
  }
  let forceStop;
  const cancellation = new AbortController();
  const children = [child];
  const stop = () => {
    cancellation.abort();
    for (const owned of children) signalLogin(owned, "SIGTERM");
    if (options !== void 0)
      recordOutcome(reviewKey, {
        status: "manual_retry_required",
        message: "Sign-in was cancelled or expired. Retry the review manually."
      });
    if (forceStop === void 0) {
      forceStop = setTimeout(() => {
        for (const owned of children) signalLogin(owned, "SIGKILL");
      }, 2e3);
      forceStop.unref();
    }
    rmSync3(loginCwd, { recursive: true, force: true });
  };
  const session = { child, stop };
  sessions.set(reviewKey, session);
  const sessionTimer = setTimeout(stop, SESSION_TIMEOUT_MS);
  sessionTimer.unref();
  const stopOnServerExit = () => {
    cancellation.abort();
    for (const owned of children) signalLogin(owned, "SIGKILL");
    rmSync3(loginCwd, { recursive: true, force: true });
  };
  process.once("exit", stopOnServerExit);
  const finish = () => {
    clearTimeout(sessionTimer);
    if (!cancellation.signal.aborted) clearTimeout(forceStop);
    process.off("exit", stopOnServerExit);
    if (sessions.get(reviewKey) === session) sessions.delete(reviewKey);
    rmSync3(loginCwd, { recursive: true, force: true });
  };
  child.once("close", (code) => {
    void (async () => {
      if (options === void 0) return;
      let resumed = false;
      try {
        if (code === 0 && session.login !== void 0 && !cancellation.signal.aborted) {
          const authenticated = await authenticationCheck(
            reviewer,
            context,
            loginCwd,
            cancellation.signal,
            (owned) => {
              children.push(owned);
            }
          );
          if (authenticated && !cancellation.signal.aborted) {
            await options.onAuthenticated(cancellation.signal);
            resumed = !cancellation.signal.aborted;
          }
        }
      } catch {
        resumed = false;
      }
      recordOutcome(
        reviewKey,
        resumed ? {
          status: "resumed",
          message: "The review resumed automatically."
        } : {
          status: "manual_retry_required",
          message: "Automatic resume could not verify the account or original request. Retry the review manually."
        }
      );
    })().finally(finish);
  });
  return new Promise((resolve, reject) => {
    let output = "";
    let settled = false;
    const timeout = setTimeout(() => {
      fail(new Error("Reviewer login did not print a sign-in URL"));
    }, LOGIN_TIMEOUT_MS);
    timeout.unref();
    function fail(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      stop();
      reject(error);
    }
    function collect(chunk) {
      if (settled) return;
      output = `${output}${chunk.toString()}`.slice(-16384);
      const found = parseReviewerLoginOutput(reviewer, output, false);
      if (found === void 0) return;
      settled = true;
      clearTimeout(timeout);
      const activeSession = sessions.get(reviewKey);
      if (activeSession !== void 0) activeSession.login = found;
      resolve(found);
    }
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.once("error", (error) => {
      fail(error);
    });
    child.once("exit", (code) => {
      if (!settled)
        fail(new Error(`Reviewer login exited before printing a URL (${code ?? "unknown"})`));
    });
  });
}

// codex-plugin/review-mcp.ts
var REVIEW_KINDS2 = /* @__PURE__ */ new Set([
  "quality-review",
  "scenario-gate",
  "plan-implementation"
]);
var automaticLogins = /* @__PURE__ */ new Set();
function rememberAutomaticLogin(key) {
  automaticLogins.add(key);
  if (automaticLogins.size > 100) {
    const [oldest] = automaticLogins;
    if (oldest !== void 0) automaticLogins.delete(oldest);
  }
}
function authenticationRecovery(root, id, data) {
  const key = `${root}:${id}`;
  if (!automaticLogins.has(key)) return void 0;
  if (isRecord(data) && data.review_id !== id) return void 0;
  return reviewerLoginOutcome(key);
}
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function paths(value, label) {
  if (!Array.isArray(value) || value.some(
    (item) => typeof item !== "string" || item.trim() === "" || nodePath7.isAbsolute(item) || item.split(/[\\/]/u).includes("..")
  )) {
    throw new Error(`${label} must contain project-relative file paths`);
  }
  return value;
}
function textResult(value, isError = false) {
  return { content: [{ type: "text", text: JSON.stringify(value) }], ...isError && { isError } };
}
function projectRootDirectory(value) {
  if (!nodePath7.isAbsolute(value) || lstatSync3(value).isSymbolicLink()) {
    throw new Error("project_root must be an absolute Safeword project directory, not a symlink");
  }
  const root = realpathSync4(value);
  if (!statSync2(root).isDirectory() || !lstatSync3(nodePath7.join(root, ".safeword", "config.json")).isFile()) {
    throw new Error("project_root must contain a regular .safeword/config.json project marker");
  }
  return root;
}
function isCodexDeviceCode(value) {
  return typeof value === "string" && /^[A-Z\d]{4,5}-[A-Z\d]{4,5}$/u.test(value);
}
function requireRegularFiles(cwd, files) {
  for (const target of files) {
    if (!lstatSync3(nodePath7.resolve(cwd, target)).isFile()) {
      throw new Error(`Review target is not a regular file: ${target}`);
    }
  }
}
function reviewInput(args) {
  if (!isRecord(args)) throw new Error("Review arguments must be an object");
  const { project_root: projectRoot, kind } = args;
  if (typeof projectRoot !== "string" || !nodePath7.isAbsolute(projectRoot)) {
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
  const cwd = projectRootDirectory(projectRoot);
  requireRegularFiles(cwd, [...targets, ...context]);
  return { cwd, kind, targets, context };
}
async function startReview(args) {
  const input = reviewInput(args);
  const result = await startReviewJob({ ...input, progress: void 0 });
  return textResult(result);
}
function reviewStatus(args) {
  if (!isRecord(args) || typeof args.review_id !== "string" || typeof args.project_root !== "string" || !nodePath7.isAbsolute(args.project_root)) {
    throw new Error("review_id and absolute project_root are required");
  }
  const root = projectRootDirectory(args.project_root);
  const result = reviewJobStatus(root, args.review_id, true);
  const data = result.data;
  const independent = hasIndependentVerdict(isRecord(data) ? data : void 0);
  return textResult({
    review_id: args.review_id,
    status: isRecord(data) && typeof data.status === "string" ? data.status : result.state,
    independent,
    authentication_recovery: authenticationRecovery(root, args.review_id, data),
    result
  });
}
function showReviewerLogin(args) {
  if (!isRecord(args) || typeof args.project_root !== "string" || !nodePath7.isAbsolute(args.project_root) || typeof args.review_id !== "string" || typeof args.auth_url !== "string") {
    throw new Error("project_root, review_id, and auth_url are required");
  }
  const root = projectRootDirectory(args.project_root);
  const result = reviewJobStatus(root, args.review_id, true);
  const reviewer = isRecord(result.data) ? result.data.assigned_reviewer : void 0;
  if (result.findings.every((finding) => finding.code !== "REVIEW_AUTHENTICATION_REQUIRED") || reviewer !== "claude" && reviewer !== "codex") {
    throw new Error("The review is not waiting for Claude or Codex authentication");
  }
  const url = new URL(args.auth_url);
  const allowedHosts = reviewer === "claude" ? /* @__PURE__ */ new Set(["claude.com", "platform.claude.com"]) : /* @__PURE__ */ new Set(["auth.openai.com", "chatgpt.com"]);
  if (url.protocol !== "https:" || !allowedHosts.has(url.hostname) || url.href.length > 8e3) {
    throw new Error("auth_url must be an HTTPS sign-in URL for the assigned reviewer");
  }
  const deviceCode = args.device_code;
  if (deviceCode !== void 0 && (reviewer !== "codex" || !isCodexDeviceCode(deviceCode))) {
    throw new Error("device_code must be a Codex device sign-in code");
  }
  const captured = capturedReviewerLogin(`${root}:${args.review_id}`);
  if (captured?.auth_url !== url.href || captured.device_code !== deviceCode) {
    throw new Error("Sign-in details do not match this review\u2019s reviewer CLI");
  }
  const automatic = automaticLogins.has(`${root}:${args.review_id}`) && isRecord(result.data) && result.data.authentication_continuation === true;
  const value = {
    reviewer,
    auth_url: url.href,
    ...deviceCode !== void 0 && { device_code: deviceCode },
    browser_launch_requested: false,
    automatic_open_allowed: false,
    ...automatic && { automatic_resume_allowed: true },
    message: loginGuidance(reviewer, automatic)
  };
  return { content: [{ type: "text", text: JSON.stringify(value) }], structuredContent: value };
}
function loginGuidance(reviewer, automatic) {
  if (automatic)
    return "Complete sign-in. This review resumes automatically after account verification while connected.";
  return reviewer === "claude" ? "Open the sign-in link and complete the Claude browser sign-in. Retry the same review after sign-in." : "Open the sign-in link and enter the device code. Retry the same review after sign-in.";
}
function loginLocation(args) {
  if (!isRecord(args) || typeof args.project_root !== "string" || !nodePath7.isAbsolute(args.project_root) || typeof args.review_id !== "string") {
    throw new Error("project_root and review_id are required");
  }
  return { root: projectRootDirectory(args.project_root), id: args.review_id };
}
async function launchReviewerLogin(args) {
  const { root, id } = loginLocation(args);
  const status = reviewJobStatus(root, id, true);
  const reviewer = isRecord(status.data) ? status.data.assigned_reviewer : void 0;
  if (status.findings.every((finding) => finding.code !== "REVIEW_AUTHENTICATION_REQUIRED") || reviewer !== "claude" && reviewer !== "codex") {
    throw new Error("The review is not waiting for Claude or Codex authentication");
  }
  const reviewKey = `${root}:${id}`;
  const { login, release } = await startBoundReviewerLogin(root, id, reviewer, status.data);
  try {
    const validated = showReviewerLogin({
      project_root: root,
      review_id: id,
      ...login
    });
    const browserLaunchRequested = await requestBrowserOpen(login.auth_url);
    release?.(true);
    const value = {
      ...validated.structuredContent,
      browser_launch_requested: browserLaunchRequested,
      automatic_open_allowed: true
    };
    return { content: [{ type: "text", text: JSON.stringify(value) }], structuredContent: value };
  } catch (error) {
    release?.(false);
    cancelReviewerLogin(reviewKey);
    throw error;
  }
}
async function startBoundReviewerLogin(root, id, reviewer, data) {
  const key = `${root}:${id}`;
  if (!isRecord(data) || data.authentication_continuation !== true)
    return { login: await startReviewerLogin(key, reviewer, root), release: void 0 };
  const recovery = await loginContinuation(root, id, reviewer);
  try {
    const login = await startReviewerLogin(key, reviewer, root, recovery.options);
    rememberAutomaticLogin(key);
    return { login, release: recovery.release };
  } catch (error) {
    recovery.release(false);
    if (!recovery.isContextChanged(error)) throw error;
    automaticLogins.delete(key);
    return { login: await startReviewerLogin(key, reviewer, root), release: void 0 };
  }
}
async function loginContinuation(root, id, reviewer) {
  const {
    assertReviewAuthenticationContext: assertReviewAuthenticationContext2,
    resumeReviewAfterAuthentication: resumeReviewAfterAuthentication2,
    ReviewAuthenticationContextChangedError: ReviewAuthenticationContextChangedError2
  } = await Promise.resolve().then(() => (init_job(), job_exports));
  let release;
  const displayed = new Promise((resolve) => {
    release = resolve;
  });
  return {
    release,
    isContextChanged: (error) => error instanceof ReviewAuthenticationContextChangedError2,
    options: {
      validateContext: (context) => {
        assertReviewAuthenticationContext2(root, id, reviewer, context);
      },
      onAuthenticated: async (signal) => {
        if (!await displayed) throw new Error("Sign-in details could not be displayed.");
        signal.throwIfAborted();
        await resumeReviewAfterAuthentication2(root, id, reviewer, signal);
      }
    }
  };
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
  },
  {
    name: "start_reviewer_login",
    description: "After REVIEW_AUTHENTICATION_REQUIRED, start the assigned reviewer sign-in and show its URL and optional code. Eligible reviews resume once after verified sign-in while connected. Keep polling the original review ID; use result.data.review_id for the resulting receipt.",
    annotations: { readOnlyHint: false, openWorldHint: true },
    _meta: { ui: { resourceUri: REVIEW_LOGIN_URI } },
    inputSchema: {
      type: "object",
      properties: {
        project_root: { type: "string", description: "Absolute project directory" },
        review_id: { type: "string" }
      },
      required: ["project_root", "review_id"]
    }
  },
  {
    name: "show_reviewer_login",
    description: "Redisplay captured sign-in details for this review. Eligible reviews resume once after verified sign-in while connected; older receipts require manual retry.",
    annotations: { readOnlyHint: true, openWorldHint: false },
    _meta: { ui: { resourceUri: REVIEW_LOGIN_URI } },
    inputSchema: {
      type: "object",
      properties: {
        project_root: { type: "string", description: "Absolute project directory" },
        review_id: { type: "string" },
        auth_url: {
          type: "string",
          description: "Exact HTTPS URL printed by the reviewer login CLI"
        },
        device_code: {
          type: "string",
          description: "Codex device code, when printed by codex login --device-auth"
        }
      },
      required: ["project_root", "review_id", "auth_url"]
    }
  }
];
async function callTool(name, args) {
  if (name === "start_review") return startReview(args);
  if (name === "review_status") return reviewStatus(args);
  if (name === "start_reviewer_login") return launchReviewerLogin(args);
  if (name === "show_reviewer_login") return showReviewerLogin(args);
  return textResult({ error: "Unknown tool" }, true);
}
async function handleReviewMcpRequest(request) {
  if (!isRecord(request) || !("id" in request)) return void 0;
  const id = request.id;
  const method = request.method;
  let result;
  try {
    if (method === "initialize") {
      result = {
        protocolVersion: "2025-06-18",
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name: "safeword-review", version: "1" }
      };
    } else if (method === "tools/list") {
      result = { tools };
    } else if (method === "resources/list") {
      result = {
        resources: [
          {
            uri: REVIEW_LOGIN_URI,
            name: "Reviewer sign-in",
            mimeType: "text/html;profile=mcp-app"
          }
        ]
      };
    } else if (method === "resources/read" && isRecord(request.params) && request.params.uri === REVIEW_LOGIN_URI) {
      result = {
        contents: [
          { uri: REVIEW_LOGIN_URI, mimeType: "text/html;profile=mcp-app", text: REVIEW_LOGIN_HTML }
        ]
      };
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
async function runReviewMcpServer(hostFlag) {
  if (hostFlag !== "--claude" && hostFlag !== "--codex") {
    throw new Error("Review MCP must be started by a plugin manifest with an explicit host flag");
  }
  process.env.SAFEWORD_AGENT_RUNTIME = hostFlag === "--claude" ? "claude" : "codex";
  process.env.SAFEWORD_REVIEW_FOREGROUND_MS = "0";
  const input = readline.createInterface({ input: process.stdin });
  const shutdown = () => {
    cancelAllReviewerLogins();
    input.close();
    process.stdin.destroy();
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  input.once("close", cancelAllReviewerLogins);
  try {
    for await (const line of input) {
      let request;
      try {
        request = JSON.parse(line);
      } catch {
        continue;
      }
      const response = await handleReviewMcpRequest(request);
      if (response !== void 0) process.stdout.write(`${JSON.stringify(response)}
`);
    }
  } finally {
    cancelAllReviewerLogins();
    input.close();
    process.off("SIGTERM", shutdown);
    process.off("SIGINT", shutdown);
  }
}
if (import.meta.main) await runReviewMcpServer(process.argv.at(-1));
export {
  handleReviewMcpRequest,
  isCodexDeviceCode,
  runReviewMcpServer
};
