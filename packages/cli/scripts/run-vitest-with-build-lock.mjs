import { spawnSync } from 'node:child_process';
import console from 'node:console';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

const scriptDirectory = import.meta.dirname;
const cliRoot = nodePath.resolve(scriptDirectory, '..');
// Vitest runs with cwd=cliRoot, so a repo-root-relative path — the natural
// spelling when invoking `bun run test` from the workspace root (#723) —
// would act as a filter that matches nothing. Rebase those onto the package.
// Only standalone arguments are rebased; `=`-joined flag values
// (`--config=packages/cli/x.ts`) pass through untouched.
const vitestArguments = process.argv
  .slice(2)
  .map(argument =>
    argument.startsWith('packages/cli/') ? argument.slice('packages/cli/'.length) : argument,
  );

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
const pathKey = Object.keys(process.env).find(key => key.toUpperCase() === 'PATH') ?? 'PATH';
const childEnvironment = {
  ...process.env,
  [pathKey]: `${process.env[pathKey] ?? ''}${nodePath.delimiter}${localBinDirectory}`,
};
const lockParent = nodePath.join(tmpdir(), 'safeword-test-locks');
const lockName = 'safeword-package-test';
const defaultMaximumLockWaitMilliseconds = 20 * 60 * 1000;
const defaultLockStatusIntervalMilliseconds = 30_000;
const initialLockStatusDelayMilliseconds = 1000;
const lockDirectory = process.env.SAFEWORD_TEST_LOCK_DIR
  ? nodePath.resolve(process.env.SAFEWORD_TEST_LOCK_DIR)
  : nodePath.join(lockParent, `${lockName}.lock`);
const ownerPath = nodePath.join(lockDirectory, 'owner.json');
const transitionDirectory = `${lockDirectory}.transition`;
const checkoutRoot = nodePath.resolve(cliRoot, '..', '..');
const minimumLockStatusIntervalMilliseconds = 50;
const maximumTransitionWaitMilliseconds = 30_000;

function resolveSafeIntegerEnvironmentVariable(name, fallback, minimum, allowZero = true) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }

  const parsed = Number(raw);
  const isValid = Number.isSafeInteger(parsed) && (allowZero ? parsed >= 0 : parsed > 0);
  return isValid ? Math.max(parsed, minimum) : fallback;
}

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

function readOwner() {
  try {
    const parsed = JSON.parse(readFileSync(ownerPath, 'utf8'));
    const owner =
      typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : {};
    const readable = isUsableOwnerPid(owner.pid) || hasUsableOwnerTimestamp(owner.createdAt);
    return {
      owner,
      readable,
    };
  } catch {
    return { owner: {}, readable: false };
  }
}

function removeStaleLock() {
  const { owner, readable } = readOwner();
  if (!readable) {
    const lockAgeMilliseconds = Date.now() - statSync(lockDirectory).mtimeMs;
    if (lockAgeMilliseconds > 30_000) {
      rmSync(lockDirectory, { force: true, recursive: true });
      return true;
    }
    return false;
  }

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

function reportLockWait(waitedMilliseconds) {
  // The owner may release or replace the lock between our EEXIST check and
  // this diagnostic read. Waiting remains correct even without metadata.
  const { owner } = readOwner();

  const ownerPid = isUsableOwnerPid(owner.pid) ? `owner PID ${owner.pid}` : 'owner PID unavailable';
  const ownerCheckout =
    typeof owner.checkoutRoot === 'string' && owner.checkoutRoot !== ''
      ? `checkout ${owner.checkoutRoot}`
      : 'checkout unavailable';
  console.error(
    `Waiting for safeword package test lock (${formatElapsedWait(waitedMilliseconds)} elapsed; ${ownerPid}; ${ownerCheckout}).`,
  );
}

function createLock(token) {
  mkdirSync(lockDirectory);
  writeFileSync(
    ownerPath,
    `${JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        checkoutRoot,
        pid: process.pid,
        token,
      },
      undefined,
      2,
    )}\n`,
  );
}

function tryEnterLockTransition() {
  try {
    mkdirSync(transitionDirectory);
    return true;
  } catch (error) {
    if (error?.code === 'EEXIST') {
      return false;
    }
    throw error;
  }
}

function leaveLockTransition() {
  rmSync(transitionDirectory, { force: true, recursive: true });
}

function tryAcquireLock(token) {
  if (!tryEnterLockTransition()) {
    return false;
  }

  try {
    try {
      createLock(token);
      return true;
    } catch (error) {
      if (error?.code !== 'EEXIST') {
        throw error;
      }
    }

    if (!removeStaleLock()) {
      return false;
    }

    createLock(token);
    return true;
  } finally {
    leaveLockTransition();
  }
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
      console.error(
        `Could not acquire safeword package test lock after waiting ${formatElapsedWait(maximumLockWaitMilliseconds)}; no test was started.`,
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
  while (!tryEnterLockTransition()) {
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

  try {
    const { owner } = readOwner();
    // eslint-disable-next-line security/detect-possible-timing-attacks -- UUID ownership identifiers are not secrets.
    if (owner.token !== token) {
      console.error(
        'Could not safely release the safeword package test lock because its ownership changed; the lock was left in place.',
      );
      return false;
    }
    rmSync(lockDirectory, { force: true, recursive: true });
    return true;
  } finally {
    leaveLockTransition();
  }
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: cliRoot,
    env: childEnvironment,
    shell: process.platform === 'win32',
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

let lockToken;
let status = 1;
try {
  lockToken = acquireLock();
  if (lockToken) {
    status = run('bun', ['run', 'build']);
    if (status === 0) {
      status = run('vitest', ['run', ...vitestArguments]);
    }
  }
} finally {
  if (lockToken && !releaseLock(lockToken)) {
    status = 1;
  }
}

process.exitCode = status ?? 1;
