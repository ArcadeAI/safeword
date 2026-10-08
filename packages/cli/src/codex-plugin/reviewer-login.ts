import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import nodePath from 'node:path';

import { reviewerEnvironment } from '../review/environment.js';
import { trustedReviewerExecutable } from '../review/runtime.js';

type Reviewer = 'claude' | 'codex';
type LoginResult = { auth_url: string; device_code?: string };
export type ReviewerLoginContext = { executable: string; environment: NodeJS.ProcessEnv };
type LoginOptions = {
  onAuthenticated: (signal: AbortSignal) => Promise<void> | void;
  validateContext?: (context: ReviewerLoginContext) => void;
};
type LoginOutcome = { status: 'resumed' | 'manual_retry_required'; message: string };
const outcomes = new Map<string, LoginOutcome>();

export function reviewerLoginOutcome(reviewKey: string): LoginOutcome | undefined {
  return outcomes.get(reviewKey);
}

function recordOutcome(reviewKey: string, outcome: LoginOutcome): void {
  outcomes.delete(reviewKey);
  outcomes.set(reviewKey, outcome);
  if (outcomes.size > 100) {
    const oldest = outcomes.keys().next().value;
    if (oldest !== undefined) outcomes.delete(oldest);
  }
}

const sessions = new Map<
  string,
  { child: ChildProcessWithoutNullStreams; login?: LoginResult; stop: () => void }
>();
const LOGIN_TIMEOUT_MS = 30_000;
const SESSION_TIMEOUT_MS = 10 * 60_000;
const AUTH_CHECK_TIMEOUT_MS = 10_000;

function qualifyingAuthentication(
  reviewer: Reviewer,
  output: string,
  environment: NodeJS.ProcessEnv,
): boolean {
  if (reviewer === 'codex') return /^Logged in using ChatGPT\s*$/u.test(output.trim());
  try {
    const status: unknown = JSON.parse(output);
    if (status === null || typeof status !== 'object') return false;
    const fields = status as Record<string, unknown>;
    const directory =
      environment.CLAUDE_CONFIG_DIR ?? nodePath.join(environment.HOME ?? homedir(), '.claude');
    return (
      nodePath.isAbsolute(directory) &&
      fields.loggedIn === true &&
      fields.authMethod === 'claude.ai' &&
      fields.configDirectory === directory
    );
  } catch {
    return false;
  }
}

function authenticationCheck(
  reviewer: Reviewer,
  context: ReviewerLoginContext,
  cwd: string,
  signal: AbortSignal,
  retain: (child: ChildProcessWithoutNullStreams) => void,
): Promise<boolean> {
  const args = reviewer === 'claude' ? ['auth', 'status', '--json'] : ['login', 'status'];
  const child = spawn(context.executable, args, {
    cwd,
    env: context.environment,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: false,
    detached: process.platform !== 'win32',
  });
  retain(child);
  return new Promise(resolve => {
    let output = '';
    let timedOut = false;
    const collect = (chunk: Buffer): void => {
      output = `${output}${chunk.toString()}`.slice(-16_384);
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    const timeout = setTimeout(() => {
      timedOut = true;
      signalLogin(child, 'SIGTERM');
      const force = setTimeout(() => {
        signalLogin(child, 'SIGKILL');
      }, 2000);
      force.unref();
    }, AUTH_CHECK_TIMEOUT_MS);
    timeout.unref();
    child.once('error', () => {
      clearTimeout(timeout);
      resolve(false);
    });
    child.once('close', code => {
      clearTimeout(timeout);
      resolve(
        !timedOut &&
          !signal.aborted &&
          code === 0 &&
          qualifyingAuthentication(reviewer, output, context.environment),
      );
    });
  });
}

// eslint-disable-next-line complexity -- Parse only complete, allowlisted CLI output and the code following its URL.
export function parseReviewerLoginOutput(
  reviewer: Reviewer,
  output: string,
): LoginResult | undefined {
  // eslint-disable-next-line no-control-regex -- The CLI may color its sign-in URL.
  const clean = output.replaceAll(/\u{1B}\[[\d;]*m/gu, '');
  const allowed =
    reviewer === 'claude' ? ['claude.com', 'platform.claude.com'] : ['auth.openai.com'];
  let url: URL | undefined;
  let urlEnd = 0;
  for (const match of clean.matchAll(/https:\/\/[^\s<>"'\p{Cc}]+(?=[\s<>"'\p{Cc}])/gu)) {
    try {
      const candidate = new URL(match[0]);
      if (allowed.includes(candidate.hostname)) {
        url = candidate;
        urlEnd = (match.index ?? 0) + match[0].length;
        break;
      }
    } catch {
      // Incomplete CLI output can contain a partial URL; wait for the next chunk.
    }
  }
  if (url === undefined || url.href.length > 8000) return undefined;
  if (reviewer === 'claude') return { auth_url: url.href };
  const deviceCode = /\b[A-Z\d]{4,5}-[A-Z\d]{4,5}\b/u.exec(clean.slice(urlEnd))?.[0];
  return deviceCode === undefined ? undefined : { auth_url: url.href, device_code: deviceCode };
}

/** A display-only call may show only what this review's live CLI printed. */
export function capturedReviewerLogin(reviewKey: string): LoginResult | undefined {
  return sessions.get(reviewKey)?.login;
}

export function cancelReviewerLogin(reviewKey: string): void {
  const session = sessions.get(reviewKey);
  if (session === undefined) return;
  sessions.delete(reviewKey);
  session.stop();
}

/** End all active vendor login processes when their MCP server shuts down. */
export function cancelAllReviewerLogins(): void {
  for (const key of sessions.keys()) cancelReviewerLogin(key);
}

function signalLogin(child: ChildProcessWithoutNullStreams, signal: NodeJS.Signals): void {
  if (child.pid === undefined) return;
  try {
    if (process.platform === 'win32') child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ESRCH')) throw error;
  }
}

/** Launches only the assigned reviewer's sign-in CLI, outside the author's shell sandbox. */
export async function startReviewerLogin(
  reviewKey: string,
  reviewer: Reviewer,
  untrustedRoot: string,
  options?: LoginOptions,
): Promise<LoginResult> {
  if (sessions.has(reviewKey))
    throw new Error('A reviewer login is already running for this review');
  const command = trustedReviewerExecutable(reviewer, untrustedRoot);
  const context = { executable: command, environment: reviewerEnvironment(reviewer) };
  options?.validateContext?.(context);
  outcomes.delete(reviewKey);
  const args = reviewer === 'claude' ? ['auth', 'login'] : ['login', '--device-auth'];
  // Authentication needs the user's vendor credential store, but never the project's cwd or environment.
  const loginCwd = mkdtempSync(nodePath.join(tmpdir(), 'safeword-reviewer-login-'));
  let child: ChildProcessWithoutNullStreams;
  try {
    child = spawn(command, args, {
      cwd: loginCwd,
      env: context.environment,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
      detached: process.platform !== 'win32',
    });
  } catch (error) {
    rmSync(loginCwd, { recursive: true, force: true });
    throw error;
  }
  let forceStop: ReturnType<typeof setTimeout> | undefined;
  const cancellation = new AbortController();
  const children = [child];
  const stop = (): void => {
    cancellation.abort();
    for (const owned of children) signalLogin(owned, 'SIGTERM');
    if (options !== undefined)
      recordOutcome(reviewKey, {
        status: 'manual_retry_required',
        message: 'Sign-in was cancelled or expired. Retry the review manually.',
      });
    if (forceStop === undefined) {
      forceStop = setTimeout(() => {
        for (const owned of children) signalLogin(owned, 'SIGKILL');
      }, 2000);
      forceStop.unref();
    }
    rmSync(loginCwd, { recursive: true, force: true });
  };
  const session = { child, stop } as {
    child: ChildProcessWithoutNullStreams;
    login?: LoginResult;
    stop: () => void;
  };
  sessions.set(reviewKey, session);
  const sessionTimer = setTimeout(stop, SESSION_TIMEOUT_MS);
  sessionTimer.unref();
  const stopOnServerExit = (): void => {
    cancellation.abort();
    for (const owned of children) signalLogin(owned, 'SIGKILL');
    rmSync(loginCwd, { recursive: true, force: true });
  };
  process.once('exit', stopOnServerExit);
  const finish = (): void => {
    clearTimeout(sessionTimer);
    if (!cancellation.signal.aborted) clearTimeout(forceStop);
    process.off('exit', stopOnServerExit);
    if (sessions.get(reviewKey) === session) sessions.delete(reviewKey);
    rmSync(loginCwd, { recursive: true, force: true });
  };
  child.once('close', code => {
    void (async () => {
      if (options === undefined) return;
      let resumed = false;
      try {
        if (code === 0 && session.login !== undefined && !cancellation.signal.aborted) {
          const authenticated = await authenticationCheck(
            reviewer,
            context,
            loginCwd,
            cancellation.signal,
            owned => {
              children.push(owned);
            },
          );
          if (authenticated && !cancellation.signal.aborted) {
            await options.onAuthenticated(cancellation.signal);
            resumed = !cancellation.signal.aborted;
          }
        }
      } catch {
        // Status exposes recovery without leaking vendor output or credential values.
        resumed = false;
      }
      recordOutcome(
        reviewKey,
        resumed
          ? {
              status: 'resumed',
              message: 'The review resumed automatically.',
            }
          : {
              status: 'manual_retry_required',
              message:
                'Automatic resume could not verify the account or original request. Retry the review manually.',
            },
      );
    })().finally(finish);
  });
  return new Promise<LoginResult>((resolve, reject) => {
    let output = '';
    let settled = false;
    const timeout = setTimeout(() => {
      fail(new Error('Reviewer login did not print a sign-in URL'));
    }, LOGIN_TIMEOUT_MS);
    timeout.unref();
    function fail(error: Error): void {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      stop();
      reject(error);
    }
    function collect(chunk: Buffer): void {
      if (settled) return;
      output = `${output}${chunk.toString()}`.slice(-16_384);
      const found = parseReviewerLoginOutput(reviewer, output);
      if (found === undefined) return;
      settled = true;
      clearTimeout(timeout);
      const activeSession = sessions.get(reviewKey);
      if (activeSession !== undefined) activeSession.login = found;
      resolve(found);
    }
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.once('error', error => {
      fail(error);
    });
    child.once('exit', code => {
      if (!settled)
        fail(new Error(`Reviewer login exited before printing a URL (${code ?? 'unknown'})`));
    });
  });
}
