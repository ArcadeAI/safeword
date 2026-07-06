import { spawnSync } from 'node:child_process';
import console from 'node:console';
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

const scriptDirectory = import.meta.dirname;
const cliRoot = nodePath.resolve(scriptDirectory, '..');
// Vitest runs with cwd=cliRoot, so a repo-root-relative path — the natural
// spelling when invoking `bun run test` from the workspace root (#723) —
// would act as a filter that matches nothing. Rebase those onto the package.
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
const lockDirectory = process.env.SAFEWORD_TEST_LOCK_DIR
  ? nodePath.resolve(process.env.SAFEWORD_TEST_LOCK_DIR)
  : nodePath.join(lockParent, `${lockName}.lock`);
const ownerPath = nodePath.join(lockDirectory, 'owner.json');

function resolveMaximumLockWaitMilliseconds() {
  const raw = process.env.SAFEWORD_TEST_LOCK_MAX_WAIT_MS;
  if (raw === undefined) {
    return defaultMaximumLockWaitMilliseconds;
  }

  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : defaultMaximumLockWaitMilliseconds;
}

const maximumLockWaitMilliseconds = resolveMaximumLockWaitMilliseconds();

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

function removeStaleLock() {
  let owner;
  try {
    owner = JSON.parse(readFileSync(ownerPath, 'utf8'));
  } catch {
    const lockAgeMilliseconds = Date.now() - statSync(lockDirectory).mtimeMs;
    if (lockAgeMilliseconds > 30_000) {
      rmSync(lockDirectory, { force: true, recursive: true });
      return true;
    }
    return false;
  }

  if (typeof owner.pid === 'number' && !isProcessAlive(owner.pid)) {
    rmSync(lockDirectory, { force: true, recursive: true });
    return true;
  }

  const createdAt = Date.parse(owner.createdAt);
  if (Number.isFinite(createdAt) && Date.now() - createdAt > 6 * 60 * 60 * 1000) {
    rmSync(lockDirectory, { force: true, recursive: true });
    return true;
  }

  return false;
}

function acquireLock() {
  mkdirSync(nodePath.dirname(lockDirectory), { recursive: true });

  let waitedMilliseconds = 0;
  let showedWaitNotice = false;
  for (;;) {
    let mkdirError;
    try {
      mkdirSync(lockDirectory);
      writeFileSync(
        ownerPath,
        `${JSON.stringify(
          {
            createdAt: new Date().toISOString(),
            pid: process.pid,
          },
          undefined,
          2,
        )}\n`,
      );
      return true;
    } catch (error) {
      mkdirError = error;
    }

    if (mkdirError?.code !== 'EEXIST') {
      throw mkdirError;
    }

    if (removeStaleLock()) {
      continue;
    }

    if (waitedMilliseconds >= maximumLockWaitMilliseconds) {
      console.error(
        `Proceeding without safeword package test lock after waiting ${maximumLockWaitMilliseconds}ms.`,
      );
      return false;
    }

    if (!showedWaitNotice && waitedMilliseconds >= 1000) {
      console.error('Waiting for another safeword package test run to finish...');
      showedWaitNotice = true;
    }

    const nextSleepMilliseconds = Math.min(250, maximumLockWaitMilliseconds - waitedMilliseconds);
    sleep(nextSleepMilliseconds);
    waitedMilliseconds += nextSleepMilliseconds;
  }
}

function releaseLock() {
  rmSync(lockDirectory, { force: true, recursive: true });
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

let acquiredLock = false;
let status;
try {
  acquiredLock = acquireLock();
  status = run('bun', ['run', 'build']);
  if (status === 0) {
    status = run('vitest', ['run', ...vitestArguments]);
  }
} finally {
  if (acquiredLock) {
    releaseLock();
  }
}

process.exitCode = status ?? 1;
