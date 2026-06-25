import { spawnSync } from 'node:child_process';
import console from 'node:console';
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

const scriptDirectory = import.meta.dirname;
const cliRoot = nodePath.resolve(scriptDirectory, '..');
const vitestArguments = process.argv.slice(2);
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
    env: process.env,
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
