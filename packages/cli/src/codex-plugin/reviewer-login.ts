import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { reviewerEnvironment } from '../review/environment.js';
import { trustedReviewerExecutable } from '../review/runtime.js';

type Reviewer = 'claude' | 'codex';
type LoginResult = { auth_url: string; device_code?: string };

const sessions = new Map<string, { child: ChildProcessWithoutNullStreams; login?: LoginResult }>();
const LOGIN_TIMEOUT_MS = 30_000;
const SESSION_TIMEOUT_MS = 10 * 60_000;

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
  session.child.kill();
}

/** Launches only the assigned reviewer's sign-in CLI, outside the author's shell sandbox. */
export async function startReviewerLogin(
  reviewKey: string,
  reviewer: Reviewer,
  untrustedRoot: string,
): Promise<LoginResult> {
  if (sessions.has(reviewKey))
    throw new Error('A reviewer login is already running for this review');
  const command = trustedReviewerExecutable(reviewer, untrustedRoot);
  const args = reviewer === 'claude' ? ['auth', 'login'] : ['login', '--device-auth'];
  // Authentication needs the user's vendor credential store, but never the project's cwd or environment.
  const loginCwd = mkdtempSync(nodePath.join(tmpdir(), 'safeword-reviewer-login-'));
  let child: ChildProcessWithoutNullStreams;
  try {
    child = spawn(command, args, {
      cwd: loginCwd,
      env: reviewerEnvironment(reviewer),
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    });
  } catch (error) {
    rmSync(loginCwd, { recursive: true, force: true });
    throw error;
  }
  const session = { child } as { child: ChildProcessWithoutNullStreams; login?: LoginResult };
  sessions.set(reviewKey, session);
  const sessionTimer = setTimeout(() => child.kill(), SESSION_TIMEOUT_MS);
  sessionTimer.unref();
  const stopOnServerExit = (): void => {
    child.kill();
    rmSync(loginCwd, { recursive: true, force: true });
  };
  process.once('exit', stopOnServerExit);
  child.once('close', () => {
    clearTimeout(sessionTimer);
    process.off('exit', stopOnServerExit);
    if (sessions.get(reviewKey) === session) sessions.delete(reviewKey);
    rmSync(loginCwd, { recursive: true, force: true });
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
      child.kill();
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
