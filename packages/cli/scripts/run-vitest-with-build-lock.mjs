import { spawnSync } from 'node:child_process';
import console from 'node:console';
import { randomUUID } from 'node:crypto';
import {
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import {
  defaultMaximumLockWaitMilliseconds,
  resolveSafeIntegerEnvironmentVariable,
} from './lib/test-lock-config.mjs';
import { environmentPathKey, resolveTestRunnerInvocation } from './test-runner-executable.mjs';

const scriptDirectory = import.meta.dirname;
const cliRoot = nodePath.resolve(scriptDirectory, '..');
// Vitest runs with cwd=cliRoot, so a repo-root-relative path — the natural
// spelling when invoking `bun run test` from the workspace root (#723) —
// would act as a filter that matches nothing. Rebase those onto the package.
// Rebase both standalone paths and `=`-joined flag values so equivalent flag
// spellings resolve consistently from cwd=cliRoot.
function rebaseVitestArgument(argument) {
  const packagePrefix = 'packages/cli/';
  if (argument.startsWith(packagePrefix)) return argument.slice(packagePrefix.length);
  const equalsIndex = argument.indexOf('=');
  if (equalsIndex === -1) return argument;
  const value = argument.slice(equalsIndex + 1);
  return value.startsWith(packagePrefix)
    ? `${argument.slice(0, equalsIndex + 1)}${value.slice(packagePrefix.length)}`
    : argument;
}

const vitestArguments = process.argv.slice(2).map(argument => rebaseVitestArgument(argument));

// The package-local bin directory holds the `vitest` executable. `bun run test`
// (and npm) inject it into PATH, but invoking this wrapper directly — e.g.
// `node scripts/run-vitest-with-build-lock.mjs tests/foo.test.ts`, safeword's own
// documented inner-loop path — does not, so `spawnSync('vitest')` fails with
// ENOENT (#715). APPEND it (never prepend): a `vitest` already on PATH — the
// npm-injected one, or a stub the test-runner-lock suite injects to exercise the
// lock without real vitest — must still win. This only supplies a fallback when
// nothing else on PATH resolves `vitest`.
const localBinDirectory = nodePath.join(cliRoot, 'node_modules', '.bin');
// Windows names the variable `Path`; spreading process.env into a plain object
// loses Node's case-insensitive access, so append to whatever key already holds
// the path (else a stray `PATH` key would sit alongside `Path` and be ignored).
const pathKey = environmentPathKey(process.env);
const inheritedPath = process.env[pathKey] ?? '';
const childEnvironment = {
  ...process.env,
  [pathKey]: inheritedPath
    ? `${inheritedPath}${nodePath.delimiter}${localBinDirectory}`
    : localBinDirectory,
};
const lockParent = nodePath.join(tmpdir(), 'safeword-test-locks');
const lockName = 'safeword-package-test';
const defaultLockStatusIntervalMilliseconds = 30_000;
const initialLockStatusDelayMilliseconds = 1000;
const usesCustomLockDirectory = Boolean(process.env.SAFEWORD_TEST_LOCK_DIR);
const lockDirectory = process.env.SAFEWORD_TEST_LOCK_DIR
  ? nodePath.resolve(process.env.SAFEWORD_TEST_LOCK_DIR)
  : nodePath.join(lockParent, `${lockName}.lock`);
const ownerPath = nodePath.join(lockDirectory, 'owner.json');
const transitionDirectory = `${lockDirectory}.transition`;
const transitionOwnerPath = nodePath.join(transitionDirectory, 'owner.json');
const transitionRecoveryDirectory = nodePath.join(transitionDirectory, 'recovery');
const transitionRecoveryOwnerPath = nodePath.join(transitionRecoveryDirectory, 'owner.json');
const checkoutRoot = nodePath.resolve(cliRoot, '..', '..');
const minimumLockStatusIntervalMilliseconds = 50;
const maximumTransitionWaitMilliseconds = 30_000;
const lockOwnerKind = 'safeword-package-test-lock';
const transitionOwnerKind = 'safeword-package-test-transition';
const transitionRecoveryOwnerKind = 'safeword-package-test-transition-recovery';

const maximumLockWaitMilliseconds = resolveSafeIntegerEnvironmentVariable(
  'SAFEWORD_TEST_LOCK_MAX_WAIT_MS',
  defaultMaximumLockWaitMilliseconds,
  0,
);

const lockStatusIntervalMilliseconds = resolveSafeIntegerEnvironmentVariable(
  'SAFEWORD_TEST_LOCK_STATUS_INTERVAL_MS',
  defaultLockStatusIntervalMilliseconds,
  minimumLockStatusIntervalMilliseconds,
  false,
);

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

function isUsableOwnerPid(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function hasUsableOwnerTimestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function hasExactKeys(value, expectedKeys) {
  const keys = Object.keys(value);
  return (
    keys.length === expectedKeys.length && expectedKeys.every(key => Object.hasOwn(value, key))
  );
}

function isLegacyLockOwner(owner) {
  return [
    hasExactKeys(owner, ['checkoutRoot', 'createdAt', 'pid', 'token']),
    typeof owner.checkoutRoot === 'string' && nodePath.isAbsolute(owner.checkoutRoot),
    hasUsableOwnerTimestamp(owner.createdAt),
    isUsableOwnerPid(owner.pid),
    typeof owner.token === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(owner.token),
  ].every(Boolean);
}

function isRecognizedTransitionOwner(owner) {
  return (
    owner.kind === transitionOwnerKind ||
    (hasExactKeys(owner, ['createdAt', 'pid']) &&
      hasUsableOwnerTimestamp(owner.createdAt) &&
      isUsableOwnerPid(owner.pid))
  );
}

function readOwnerAt(path) {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    const owner =
      typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : {};
    const readable = isUsableOwnerPid(owner.pid) || hasUsableOwnerTimestamp(owner.createdAt);
    return {
      owner,
      readable,
      valid: owner.kind === lockOwnerKind || isLegacyLockOwner(owner),
    };
  } catch {
    return { owner: {}, readable: false, valid: false };
  }
}

function readOwner() {
  return readOwnerAt(ownerPath);
}

function directoryAgeMilliseconds(path) {
  try {
    return Date.now() - statSync(path).mtimeMs;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

function removeAgedUnreadableLock(allowCustomPath) {
  if (!allowCustomPath && usesCustomLockDirectory) return false;
  const lockAgeMilliseconds = directoryAgeMilliseconds(lockDirectory);
  if (lockAgeMilliseconds === false) return true;
  if (lockAgeMilliseconds <= 30_000) return false;
  rmSync(lockDirectory, { force: true, recursive: true });
  return true;
}

function removeStaleLock() {
  const { owner, readable, valid } = readOwner();
  if (!valid) {
    // Only the dedicated default tmp namespace is safe to reclaim when a
    // creator died after mkdir but before publishing recognizable metadata.
    return !readable && removeAgedUnreadableLock(false);
  }
  if (!readable) return removeAgedUnreadableLock(true);

  if (isUsableOwnerPid(owner.pid) && !isProcessAlive(owner.pid)) {
    rmSync(lockDirectory, { force: true, recursive: true });
    return true;
  }

  // A usable live PID is authoritative. Wall-clock age cannot prove that the
  // owner stopped running, and reaping it would allow concurrent test runs.
  if (isUsableOwnerPid(owner.pid)) {
    return false;
  }

  if (
    hasUsableOwnerTimestamp(owner.createdAt) &&
    Date.now() - Date.parse(owner.createdAt) > 6 * 60 * 60 * 1000
  ) {
    rmSync(lockDirectory, { force: true, recursive: true });
    return true;
  }

  return false;
}

function formatElapsedWait(milliseconds) {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  }

  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes === 0 ? `${seconds}s` : `${minutes}m ${seconds}s`;
}

function currentLockOwnerDetails() {
  // The owner may release or replace the lock between our EEXIST check and
  // this diagnostic read. Diagnostics remain useful even without metadata.
  const { owner } = readOwner();
  return {
    checkoutRoot:
      typeof owner.checkoutRoot === 'string' && owner.checkoutRoot !== ''
        ? owner.checkoutRoot
        : undefined,
    pid: isUsableOwnerPid(owner.pid) ? owner.pid : undefined,
  };
}

function reportLockWait(waitedMilliseconds) {
  const { checkoutRoot, pid } = currentLockOwnerDetails();
  const ownerPid = pid === undefined ? 'owner PID unavailable' : `owner PID ${pid}`;
  const ownerCheckout =
    checkoutRoot === undefined ? 'checkout unavailable' : `checkout ${checkoutRoot}`;
  console.error(
    `Waiting for safeword package test lock (${formatElapsedWait(waitedMilliseconds)} elapsed; ${ownerPid}; ${ownerCheckout}).`,
  );
}

function createLock(token) {
  mkdirSync(lockDirectory);
  try {
    writeFileSync(
      ownerPath,
      `${JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          checkoutRoot,
          kind: lockOwnerKind,
          pid: process.pid,
          token,
        },
        undefined,
        2,
      )}\n`,
    );
  } catch (error) {
    rmSync(lockDirectory, { force: true, recursive: true });
    throw error;
  }
}

function tryCreateLock(token) {
  try {
    createLock(token);
    return true;
  } catch (error) {
    if (error?.code === 'EEXIST' || error?.code === 'ENOTEMPTY') return false;
    throw error;
  }
}

function createLockTransition(token) {
  mkdirSync(transitionDirectory);
  try {
    writeFileSync(
      transitionOwnerPath,
      `${JSON.stringify({ createdAt: new Date().toISOString(), kind: transitionOwnerKind, pid: process.pid, token })}\n`,
    );
  } catch (error) {
    rmSync(transitionDirectory, { force: true, recursive: true });
    throw error;
  }
}

function tryCreateLockTransition(token) {
  try {
    createLockTransition(token);
    return true;
  } catch (error) {
    if (error?.code === 'EEXIST' || error?.code === 'ENOTEMPTY') return false;
    throw error;
  }
}

function unreadableTransitionIsAgedSafewordResidue() {
  if (usesCustomLockDirectory) return false;
  try {
    const entries = readdirSync(transitionDirectory);
    const hasOnlySafewordResidue = entries.every(entry =>
      ['owner.json', 'recovery'].includes(entry),
    );
    return hasOnlySafewordResidue && Date.now() - statSync(transitionDirectory).mtimeMs > 30_000;
  } catch {
    return false;
  }
}

function lockTransitionIsAbandoned(unreadableFallback) {
  const { owner, readable } = readOwnerAt(transitionOwnerPath);
  if (readable && !isRecognizedTransitionOwner(owner)) return false;
  if (isUsableOwnerPid(owner.pid)) return !isProcessAlive(owner.pid);
  if (readable) return false;
  if (typeof unreadableFallback === 'boolean') return unreadableFallback;
  return unreadableTransitionIsAgedSafewordResidue();
}

function transitionRecoveryIsAbandoned() {
  const { owner, readable } = readOwnerAt(transitionRecoveryOwnerPath);
  if (owner.kind === transitionRecoveryOwnerKind && isUsableOwnerPid(owner.pid))
    return !isProcessAlive(owner.pid);
  if (readable) return false;
  try {
    return (
      Date.now() - statSync(transitionRecoveryDirectory).mtimeMs > maximumTransitionWaitMilliseconds
    );
  } catch {
    return false;
  }
}

function removeAbandonedTransitionRecovery() {
  if (!transitionRecoveryIsAbandoned()) return false;

  const abandonedRecoveryDirectory = `${transitionRecoveryDirectory}.abandoned-${randomUUID()}`;
  try {
    renameSync(transitionRecoveryDirectory, abandonedRecoveryDirectory);
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
  rmSync(abandonedRecoveryDirectory, { force: true, recursive: true });
  return true;
}

function tryEnterTransitionRecovery(token) {
  try {
    mkdirSync(transitionRecoveryDirectory);
    writeFileSync(
      transitionRecoveryOwnerPath,
      `${JSON.stringify({ createdAt: new Date().toISOString(), kind: transitionRecoveryOwnerKind, pid: process.pid, token })}\n`,
    );
    return true;
  } catch (error) {
    if (error?.code === 'EEXIST') {
      return removeAbandonedTransitionRecovery() && tryEnterTransitionRecovery(token);
    }
    rmSync(transitionRecoveryDirectory, { force: true, recursive: true });
    if (error?.code === 'ENOENT' || error?.code === 'EINVAL') return false;
    throw error;
  }
}

function leaveTransitionRecovery(token) {
  const { owner } = readOwnerAt(transitionRecoveryOwnerPath);
  if (owner.pid !== process.pid || owner.token !== token) return false;
  const releasedRecoveryDirectory = `${transitionRecoveryDirectory}.released-${randomUUID()}`;
  try {
    renameSync(transitionRecoveryDirectory, releasedRecoveryDirectory);
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
  rmSync(releasedRecoveryDirectory, { force: true, recursive: true });
  return true;
}

function tryRecoverLockTransition(token) {
  // Check age before changing the directory: creating a child would refresh
  // the mtime and make an abandoned empty transition look fresh forever.
  const wasAbandoned = lockTransitionIsAbandoned();
  if (!wasAbandoned) return false;
  if (!tryEnterTransitionRecovery(token)) return false;
  try {
    // Another contender may have claimed the transition after our first
    // observation but before we acquired the recovery marker.
    if (!lockTransitionIsAbandoned(wasAbandoned)) return false;
    writeFileSync(
      transitionOwnerPath,
      `${JSON.stringify({ createdAt: new Date().toISOString(), kind: transitionOwnerKind, pid: process.pid, token })}\n`,
    );
    return true;
  } finally {
    leaveTransitionRecovery(token);
  }
}

function tryEnterLockTransition(token) {
  if (tryCreateLockTransition(token)) return true;
  const { owner } = readOwnerAt(transitionOwnerPath);
  if (owner.pid === process.pid && owner.token === token) return true;
  return tryRecoverLockTransition(token);
}

function leaveLockTransitionUnsafe(token) {
  let waitedMilliseconds = 0;
  while (!tryEnterTransitionRecovery(token)) {
    if (!existsSync(transitionDirectory)) return true;
    if (waitedMilliseconds >= maximumTransitionWaitMilliseconds) {
      throw new Error('Could not safely leave the safeword package test lock transition.');
    }
    sleep(10);
    waitedMilliseconds += 10;
  }

  const { owner } = readOwnerAt(transitionOwnerPath);
  if (owner.pid !== process.pid || owner.token !== token) {
    leaveTransitionRecovery(token);
    throw new Error(
      'Could not safely leave the safeword package test lock transition because its ownership changed.',
    );
  }

  const releasedTransitionDirectory = `${transitionDirectory}.released-${randomUUID()}`;
  try {
    // Move the parent while holding its recovery marker. Contenders can no
    // longer recreate a child between recursive traversal and parent removal.
    renameSync(transitionDirectory, releasedTransitionDirectory);
  } catch (error) {
    if (error?.code === 'ENOENT') return true;
    leaveTransitionRecovery(token);
    throw error;
  }
  rmSync(releasedTransitionDirectory, { force: true, recursive: true });
  return true;
}

function leaveLockTransition(token) {
  try {
    return leaveLockTransitionUnsafe(token);
  } catch (error) {
    console.error('Could not safely leave the safeword package test lock transition:', error);
    return false;
  }
}

function tryAcquireLock(token) {
  if (!tryEnterLockTransition(token)) {
    return false;
  }

  let acquired = false;
  let failure;
  try {
    acquired = tryCreateLock(token) || (removeStaleLock() && tryCreateLock(token));
  } catch (error) {
    failure = error;
  }
  if (failure) {
    leaveLockTransition(token);
    throw failure;
  }
  // A failed transition cleanup must not turn a lock we already own into
  // contention against ourselves. Keep the token so the outer finally can
  // still release the lock (and report failure if the transition remains).
  leaveLockTransition(token);
  return acquired;
}

function acquireLock() {
  mkdirSync(nodePath.dirname(lockDirectory), { recursive: true });
  const token = randomUUID();

  let waitedMilliseconds = 0;
  let nextStatusAtMilliseconds = Math.min(
    initialLockStatusDelayMilliseconds,
    lockStatusIntervalMilliseconds,
  );
  for (;;) {
    if (tryAcquireLock(token)) {
      return token;
    }

    if (waitedMilliseconds >= maximumLockWaitMilliseconds) {
      const { checkoutRoot, pid } = currentLockOwnerDetails();
      const ownerPid = pid === undefined ? 'unavailable' : `PID ${pid}`;
      const ownerCheckout = checkoutRoot ?? 'an unavailable checkout';
      console.error(
        `Could not acquire safeword package test lock at ${lockDirectory} after waiting ${formatElapsedWait(maximumLockWaitMilliseconds)}; no test was started. The active owner is ${ownerPid} in ${ownerCheckout}. A transition may be blocked at ${transitionDirectory}. Re-run after it finishes, set SAFEWORD_TEST_LOCK_MAX_WAIT_MS to a larger positive millisecond value, or remove either directory only if you are sure no package test is running.`,
      );
      return false;
    }

    if (waitedMilliseconds >= nextStatusAtMilliseconds) {
      reportLockWait(waitedMilliseconds);
      nextStatusAtMilliseconds += lockStatusIntervalMilliseconds;
    }

    const nextSleepMilliseconds = Math.min(
      250,
      maximumLockWaitMilliseconds - waitedMilliseconds,
      nextStatusAtMilliseconds - waitedMilliseconds,
    );
    sleep(nextSleepMilliseconds);
    waitedMilliseconds += nextSleepMilliseconds;
  }
}

function releaseLock(token) {
  let waitedMilliseconds = 0;
  while (!tryEnterLockTransition(token)) {
    if (waitedMilliseconds >= maximumTransitionWaitMilliseconds) {
      console.error(
        'Could not safely release the safeword package test lock; the lock was left in place.',
      );
      return false;
    }
    const nextSleepMilliseconds = Math.min(
      50,
      maximumTransitionWaitMilliseconds - waitedMilliseconds,
    );
    sleep(nextSleepMilliseconds);
    waitedMilliseconds += nextSleepMilliseconds;
  }

  let released = false;
  let failure;
  try {
    const { owner } = readOwner();
    // eslint-disable-next-line security/detect-possible-timing-attacks -- UUID ownership identifiers are not secrets.
    if (owner.token === token) {
      rmSync(lockDirectory, { force: true, recursive: true });
      released = true;
    } else {
      console.error(
        'Could not safely release the safeword package test lock because its ownership changed; the lock was left in place.',
      );
    }
  } catch (error) {
    failure = error;
  }
  if (failure) {
    leaveLockTransition(token);
    throw failure;
  }
  return leaveLockTransition(token) && released;
}

function run(command, args, environment = childEnvironment) {
  const invocation = resolveTestRunnerInvocation(command, args, environment, cliRoot);
  const result = spawnSync(invocation.executable, invocation.arguments, {
    cwd: cliRoot,
    env: environment,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.signal) {
    console.error(`${command} terminated with signal ${result.signal}`);
    return 1;
  }

  return result.status ?? 1;
}

function packageSnapshotEntries() {
  const packageJsonPath = nodePath.join(cliRoot, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  if (!Array.isArray(packageJson.files) || packageJson.files.length === 0) {
    throw new Error('Package snapshot requires a non-empty package.json files array.');
  }
  for (const entry of packageJson.files) {
    if (typeof entry !== 'string' || entry.trim() === '') {
      throw new Error('Package snapshot entries must be non-empty strings.');
    }
    if (entry.startsWith('!') || /[*?[\]{}()]/u.test(entry)) {
      throw new Error(`Package snapshot does not support package.json files patterns: ${entry}`);
    }
  }
  return ['package.json', ...packageJson.files];
}

function pathEscapesRoot(relativePath) {
  return (
    relativePath === '' ||
    relativePath === '..' ||
    relativePath.startsWith(`..${nodePath.sep}`) ||
    nodePath.isAbsolute(relativePath)
  );
}

function assertSnapshotTreeHasNoSymlinks(path, entry) {
  const stats = lstatSync(path);
  if (stats.isSymbolicLink()) {
    throw new Error(`Package snapshot entry contains a symbolic link: ${entry}`);
  }
  if (!stats.isDirectory()) return;
  for (const child of readdirSync(path)) {
    assertSnapshotTreeHasNoSymlinks(nodePath.join(path, child), entry);
  }
}

function packageSnapshotSource(entry, canonicalCliRoot) {
  const source = nodePath.resolve(cliRoot, entry);
  const packageRelativeSource = nodePath.relative(cliRoot, source);
  if (pathEscapesRoot(packageRelativeSource)) {
    throw new Error(`Package snapshot entry escapes the CLI package: ${entry}`);
  }
  if (!existsSync(source)) {
    throw new Error(`Package snapshot entry does not exist: ${entry}`);
  }
  const canonicalRelativeSource = nodePath.relative(canonicalCliRoot, realpathSync(source));
  if (pathEscapesRoot(canonicalRelativeSource)) {
    throw new Error(`Package snapshot entry resolves outside the CLI package: ${entry}`);
  }
  assertSnapshotTreeHasNoSymlinks(source, entry);
  return { packageRelativeSource, source };
}

function canonicalActivePackageSnapshot() {
  if (!process.env.SAFEWORD_TEST_CLI_ROOT) return false;
  try {
    return realpathSync(process.env.SAFEWORD_TEST_CLI_ROOT);
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

function removeAgedPackageSnapshots(snapshotParent) {
  const activeSnapshot = canonicalActivePackageSnapshot();
  for (const entry of readdirSync(snapshotParent)) {
    if (!entry.startsWith('safeword-test-package-')) continue;
    const snapshot = nodePath.join(snapshotParent, entry);
    try {
      if (realpathSync(snapshot) === activeSnapshot) continue;
      if (Date.now() - statSync(snapshot).mtimeMs <= 6 * 60 * 60 * 1000) continue;
      rmSync(snapshot, { force: true, recursive: true });
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
}

function createPackageSnapshot() {
  // Keep the snapshot under node_modules so externalized runtime dependencies
  // resolve naturally, but outside the tracked package tree so a killed run
  // cannot leave `.test-package-*` worktree residue.
  const snapshotParent = nodePath.join(cliRoot, 'node_modules', '.cache');
  mkdirSync(snapshotParent, { recursive: true });
  removeAgedPackageSnapshots(snapshotParent);
  const snapshotRoot = mkdtempSync(nodePath.join(snapshotParent, 'safeword-test-package-'));
  const canonicalCliRoot = realpathSync(cliRoot);
  try {
    for (const entry of packageSnapshotEntries()) {
      const snapshotSource = packageSnapshotSource(entry, canonicalCliRoot);
      const { packageRelativeSource, source } = snapshotSource;
      const destination = nodePath.join(snapshotRoot, packageRelativeSource);
      mkdirSync(nodePath.dirname(destination), { recursive: true });
      if (statSync(source).isDirectory()) {
        cpSync(source, destination, { recursive: true });
      } else {
        copyFileSync(source, destination);
      }
    }
    const snapshotCli = nodePath.join(snapshotRoot, 'dist', 'cli.js');
    if (!existsSync(snapshotCli)) {
      throw new Error(`Built CLI is missing from the package test snapshot: ${snapshotCli}`);
    }
    return snapshotRoot;
  } catch (error) {
    rmSync(snapshotRoot, { force: true, recursive: true });
    throw error;
  }
}

function removePackageSnapshot(snapshotRoot) {
  try {
    rmSync(snapshotRoot, { force: true, recursive: true });
    return true;
  } catch (error) {
    console.error(`Could not remove package test snapshot ${snapshotRoot}:`, error);
    return false;
  }
}

let lockToken;
let packageSnapshot;
let status = 1;
try {
  lockToken = acquireLock();
  if (lockToken) {
    status = run('bun', ['run', 'build']);
    if (status === 0) {
      packageSnapshot = createPackageSnapshot();
      status = run('vitest', ['run', ...vitestArguments], {
        ...childEnvironment,
        SAFEWORD_TEST_CLI_ROOT: packageSnapshot,
      });
    }
  }
} finally {
  if (packageSnapshot) removePackageSnapshot(packageSnapshot);
  if (lockToken && !releaseLock(lockToken)) {
    status = 1;
  }
}

process.exitCode = status ?? 1;
