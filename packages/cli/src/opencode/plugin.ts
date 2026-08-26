export interface OpenCodeProfilePluginOptions {
  readonly markerTimeoutMilliseconds?: number;
}

const DEFAULT_MARKER_TIMEOUT_MILLISECONDS = 50;

function profilePluginSource(markerTimeoutMilliseconds: number): string {
  return String.raw`import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const profileRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const identityPath = path.join(profileRoot, 'safeword', 'identity-v1.json');
const profileErrorPath = path.join(profileRoot, 'safeword', 'profile-error-v1.json');
const MARKER_TIMEOUT_MILLISECONDS = ${markerTimeoutMilliseconds};
const DENIAL = 'Safeword denied this OpenCode tool call.';
const REPAIR = 'Safeword cannot run its OpenCode guard. Run safeword install --agents=opencode.';

class UnavailableDispatcher extends Error {}

function canonicalEnvelope(input, output) {
  if (!['bash', 'shell', 'edit', 'write', 'patch', 'apply_patch'].includes(input?.tool)) {
    return undefined;
  }
  const args = output?.args;
  if (args === null || typeof args !== 'object' || Array.isArray(args)) throw new Error(DENIAL);
  if (input.tool === 'bash' || input.tool === 'shell') {
    if (typeof args.command !== 'string' || args.command.length === 0) throw new Error(DENIAL);
    return { hook_event_name: 'PreToolUse', session_id: input.sessionID, tool_name: 'Bash', tool_input: { command: args.command } };
  }
  if (input.tool === 'edit' || input.tool === 'write') {
    if (typeof args.filePath !== 'string' || args.filePath.length === 0) throw new Error(DENIAL);
    return {
      hook_event_name: 'PreToolUse',
      session_id: input.sessionID,
      tool_name: input.tool === 'edit' ? 'Edit' : 'Write',
      tool_input: { file_path: args.filePath },
    };
  }
  if (input.tool === 'patch' || input.tool === 'apply_patch') {
    if (
      typeof args.patchText !== 'string' ||
      args.patchText.length === 0 ||
      !/^[*][*][*] (?:Add|Update|Delete) File: .+$/m.test(args.patchText)
    ) throw new Error(DENIAL);
    return { hook_event_name: 'PreToolUse', session_id: input.sessionID, tool_name: 'apply_patch', tool_input: { command: args.patchText } };
  }
  return undefined;
}

async function classifyProject(directory) {
  if (MARKER_TIMEOUT_MILLISECONDS === 0) return 'uncertain';
  let timer;
  const marker = access(path.join(directory, '.safeword', 'SAFEWORD.md')).then(
    () => 'marked',
    error => error?.code === 'ENOENT' ? 'unmarked' : 'uncertain',
  );
  const deadline = new Promise(resolve => {
    timer = setTimeout(() => resolve('uncertain'), MARKER_TIMEOUT_MILLISECONDS);
  });
  try {
    return await Promise.race([marker, deadline]);
  } finally {
    clearTimeout(timer);
  }
}

async function readIdentity() {
  return JSON.parse(await readFile(identityPath, 'utf8'));
}

async function recordMarkerResolutionFailure() {
  let temporaryPath;
  try {
    const identity = await readIdentity();
    const evidence = {
      schema_version: 1,
      safeword_version: identity.safeword_version,
      plugin_sha256: identity.plugin_sha256,
      error_code: 'marker_resolution_failed',
      observed_at: new Date().toISOString(),
    };
    await mkdir(path.dirname(profileErrorPath), { recursive: true });
    temporaryPath = profileErrorPath + '.' + process.pid + '.' + randomUUID() + '.tmp';
    await writeFile(temporaryPath, JSON.stringify(evidence) + '\n', { mode: 0o600 });
    await rename(temporaryPath, profileErrorPath);
    temporaryPath = undefined;
  } catch {
    // Evidence is diagnostic; classification uncertainty must remain fail-open.
  } finally {
    if (temporaryPath !== undefined) await rm(temporaryPath, { force: true }).catch(() => {});
  }
}

async function readBoundIdentity() {
  const identity = await readIdentity();
  try {
    const dispatcher = await readFile(identity.dispatcher_path);
    const hash = createHash('sha256').update(dispatcher).digest('hex');
    if (hash !== identity.dispatcher_sha256) throw new UnavailableDispatcher();
    await access(identity.runtime_path, constants.X_OK);
  } catch (error) {
    if (error instanceof UnavailableDispatcher) throw error;
    throw new UnavailableDispatcher();
  }
  return identity;
}

function dispatch(identity, envelope) {
  return new Promise((resolve, reject) => {
    const child = spawn(identity.runtime_path, [identity.dispatcher_path], {
      cwd: process.cwd(),
      shell: false,
      env: {
        ...process.env,
        SAFEWORD_AGENT_RUNTIME: 'opencode',
        SAFEWORD_CODEX_DENY_MODE: 'exit-code',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let settled = false;
    const finish = (action) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      action();
    };
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      finish(() => reject(new Error(DENIAL)));
    }, 2_000);
    child.stdout.setEncoding('utf8').on('data', chunk => {
      stdout += chunk;
    });
    child.once('error', () => finish(() => reject(new Error(DENIAL))));
    child.once('close', exitCode => finish(() => resolve({ exitCode, stdout })));
    child.stdin.end(JSON.stringify(envelope));
  });
}

export const Safeword = async input => ({
  'tool.execute.before': async (hookInput, output) => {
    if (!input?.directory) return;
    const classification = await classifyProject(input.directory);
    if (classification === 'uncertain') {
      await recordMarkerResolutionFailure();
      return;
    }
    if (classification === 'unmarked') return;
    const envelope = canonicalEnvelope(hookInput, output);
    if (envelope === undefined) return;
    let result;
    try {
      result = await dispatch(await readBoundIdentity(), envelope);
    } catch (error) {
      if (error instanceof UnavailableDispatcher) throw new Error(REPAIR);
      throw new Error(DENIAL);
    }
    if (result.exitCode === 0) return;
    throw new Error(DENIAL);
  },
});
`;
}

export function generateOpenCodeProfilePlugin(options: OpenCodeProfilePluginOptions = {}): string {
  const configured = options.markerTimeoutMilliseconds;
  const markerTimeoutMilliseconds =
    configured !== undefined && Number.isFinite(configured) && configured >= 0
      ? configured
      : DEFAULT_MARKER_TIMEOUT_MILLISECONDS;
  return profilePluginSource(markerTimeoutMilliseconds);
}
