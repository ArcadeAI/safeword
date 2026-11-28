import { FEATURE_EDIT_DENIED_EXIT_CODE } from '../../templates/hooks/lib/quality-state.js';
import { COMPLETION_HOOK_TIMEOUT_SECONDS } from '../templates/config.js';
import { OBSERVED_FEATURE_BINDING } from './observe-ticket.js';

export interface OpenCodeProfilePluginOptions {
  readonly markerTimeoutMilliseconds?: number;
}

const DEFAULT_MARKER_TIMEOUT_MILLISECONDS = 50;

function profilePluginSource(markerTimeoutMilliseconds: number): string {
  return String.raw`import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { access, mkdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const profileRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const identityPath = path.join(profileRoot, 'safeword', 'identity-v1.json');
const profileErrorPath = path.join(profileRoot, 'safeword', 'profile-error-v1.json');
const activationRoot = path.join(profileRoot, 'safeword', 'activation-v1');
const MARKER_TIMEOUT_MILLISECONDS = ${markerTimeoutMilliseconds};
const INCOMPLETE_FEATURE_EVIDENCE_EXIT_CODE = 3;
const DENIAL = 'Safeword denied this OpenCode tool call.';
const INCOMPLETE_FEATURE_EVIDENCE = 'Safeword blocked this ticket close because its feature evidence is incomplete. Check test-definitions.md and its referenced feature source: complete every scenario, fix missing or malformed evidence, remove @wip, and retry.';
const REPAIR = 'Safeword cannot run its OpenCode guard. Run safeword install --agents=opencode.';

function featureSessionHint(id) {
  const session = 'opencode-' + (String(id).trim().replace(/[^A-Za-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'') || 'id');
  return 'If the user switches to unrelated work, run safeword ticket pause <ticket-id> ' + session + ' in this checkout. Run safeword ticket resume <ticket-id> ' + session + ' before returning.';
}

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
    const editFields = input.tool === 'edit'
      ? {
          ...(typeof args.oldString === 'string' ? { old_string: args.oldString } : {}),
          ...(typeof args.newString === 'string' ? { new_string: args.newString } : {}),
        }
      : typeof args.content === 'string'
        ? { content: args.content }
        : {};
    return {
      hook_event_name: 'PreToolUse',
      session_id: input.sessionID,
      tool_name: input.tool === 'edit' ? 'Edit' : 'Write',
      tool_input: { file_path: args.filePath, ...editFields },
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
  if (MARKER_TIMEOUT_MILLISECONDS === 0) return { kind: 'uncertain' };
  let timer;
  const marker = (async () => {
    let candidate = path.resolve(directory);
    while (true) {
      for (const marker of ['enrolled', 'SAFEWORD.md']) {
        try {
          await access(path.join(candidate, '.safeword', marker));
          return { kind: 'marked', directory: candidate };
        } catch (error) {
          if (error?.code !== 'ENOENT') return { kind: 'uncertain' };
        }
      }
      const parent = path.dirname(candidate);
      if (parent === candidate) return { kind: 'unmarked' };
      candidate = parent;
    }
  })();
  const deadline = new Promise(resolve => {
    timer = setTimeout(() => resolve({ kind: 'uncertain' }), MARKER_TIMEOUT_MILLISECONDS);
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

async function atomicWrite(destination, content) {
  let temporaryPath;
  try {
    await mkdir(path.dirname(destination), { recursive: true });
    temporaryPath = destination + '.' + process.pid + '.' + randomUUID() + '.tmp';
    await writeFile(temporaryPath, content, { mode: 0o600 });
    await rename(temporaryPath, destination);
    temporaryPath = undefined;
  } finally {
    if (temporaryPath !== undefined) await rm(temporaryPath, { force: true }).catch(() => {});
  }
}

async function recordMarkerResolutionFailure() {
  try {
    const identity = await readIdentity();
    await atomicWrite(profileErrorPath, JSON.stringify({
      schema_version: 1,
      safeword_version: identity.safeword_version,
      plugin_sha256: identity.plugin_sha256,
      error_code: 'marker_resolution_failed',
      observed_at: new Date().toISOString(),
    }) + '\n');
  } catch {
    // Evidence is diagnostic; classification uncertainty must remain fail-open.
  }
}

async function recordActivation(directory, event, sessionID, callID) {
  try {
    const [identity, canonicalProject] = await Promise.all([readIdentity(), realpath(directory)]);
    const projectHash = createHash('sha256').update(canonicalProject).digest('hex');
    const evidence = {
      schema_version: 1,
      safeword_version: identity.safeword_version,
      plugin_sha256: identity.plugin_sha256,
      project_sha256: projectHash,
      event,
      ...(sessionID === undefined ? {} : { session_id_sha256: createHash('sha256').update(sessionID).digest('hex') }),
      ...(callID === undefined ? {} : { call_id_sha256: createHash('sha256').update(callID).digest('hex') }),
      observed_at: new Date().toISOString(),
    };
    await atomicWrite(path.join(activationRoot, projectHash + '-' + event + '.json'), JSON.stringify(evidence) + '\n');
  } catch {
    // Activation is diagnostic and never changes the host operation.
  }
}

async function clearProfileError() {
  await rm(profileErrorPath, { force: true }).catch(() => {});
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

function dispatch(identity, envelope, directory, args = []) {
  const inputText = Object.values(envelope.tool_input).filter(value => typeof value === 'string').join('\n');
  const timeoutMilliseconds = /ticket\.md/u.test(inputText) && /status:\s*['"]?done\b/u.test(inputText)
    ? ${COMPLETION_HOOK_TIMEOUT_SECONDS * 1000}
    : /\bVERIFIED\b/iu.test(inputText) ? 30_000 : 2_000;
  return new Promise((resolve, reject) => {
    const child = spawn(identity.runtime_path, [identity.dispatcher_path, ...args], {
      cwd: directory,
      shell: false,
      env: {
        ...process.env,
        CLAUDE_PROJECT_DIR: directory,
        SAFEWORD_AGENT_RUNTIME: 'opencode',
        SAFEWORD_CODEX_DENY_MODE: 'exit-code',
      },
      stdio: ['pipe', 'ignore', 'ignore'],
    });
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
    }, timeoutMilliseconds);
    child.once('error', () => finish(() => reject(new Error(DENIAL))));
    child.stdin.once('error', () => finish(() => reject(new Error(DENIAL))));
    child.once('close', exitCode => finish(() => resolve({ exitCode })));
    child.stdin.end(JSON.stringify(envelope));
  });
}

export const Safeword = async input => {
  function eventSessionID(event) {
    return event?.properties?.sessionID ?? event?.properties?.info?.id;
  }

  async function recordLifecycle(event, sessionID, callID) {
    if (!input?.directory || typeof sessionID !== 'string' || sessionID.length === 0) return;
    const classification = await classifyProject(input.directory);
    if (classification.kind === 'uncertain') {
      await recordMarkerResolutionFailure();
      return;
    }
    if (classification.kind === 'unmarked') return;
    await clearProfileError();
    await recordActivation(classification.directory, event, sessionID, callID);
    return classification.directory;
  }

  if (input?.directory) {
    const classification = await classifyProject(input.directory);
    if (classification.kind === 'marked') await recordActivation(classification.directory, 'plugin_load');
    else if (classification.kind === 'uncertain') await recordMarkerResolutionFailure();
  }
  return {
    event: async ({ event }) => {
      if (event?.type === 'session.created') {
        await recordLifecycle('session_start', eventSessionID(event));
      } else if (event?.type === 'session.idle') {
        await recordLifecycle('stop', eventSessionID(event));
      }
    },
    'chat.message': async (hookInput, output) => {
      await recordLifecycle('prompt_submit', hookInput?.sessionID ?? output?.message?.sessionID);
    },
    'tool.execute.before': async (hookInput, output) => {
      if (!input?.directory) return;
      const classification = await classifyProject(input.directory);
      if (classification.kind === 'uncertain') {
        await recordMarkerResolutionFailure();
        return;
      }
      if (classification.kind === 'unmarked') return;
      await clearProfileError();
      const envelope = canonicalEnvelope(hookInput, output);
      if (envelope === undefined) {
        await recordActivation(classification.directory, 'uncovered_tool', hookInput.sessionID, hookInput.callID);
        return;
      }
      let result;
      try {
        const directory = envelope.tool_name === 'Bash' && typeof output.args.workdir === 'string'
          ? path.resolve(input.directory, output.args.workdir)
          : input.directory;
        const scoped = directory === classification.directory ? envelope : { ...envelope, cwd: directory };
        result = await dispatch(await readBoundIdentity(), scoped, classification.directory);
      } catch (error) {
        if (error instanceof UnavailableDispatcher) throw new Error(REPAIR);
        throw new Error(DENIAL);
      }
      await recordActivation(classification.directory, 'pre_tool', hookInput.sessionID, hookInput.callID);
      if (result.exitCode === 0) return;
      if (result.exitCode === ${FEATURE_EDIT_DENIED_EXIT_CODE}) {
        throw new Error('Finish the Product Plan, obtain independent intake approval and run the returned review advance-intake command. ' + featureSessionHint(hookInput.sessionID));
      }
      if (result.exitCode === INCOMPLETE_FEATURE_EVIDENCE_EXIT_CODE) throw new Error(INCOMPLETE_FEATURE_EVIDENCE);
      throw new Error(DENIAL);
    },
    'tool.execute.after': async (hookInput, output) => {
      const directory = await recordLifecycle('post_tool', hookInput?.sessionID, hookInput?.callID);
      if (!directory || !hookInput.args ||
          !['edit','write','patch','apply_patch'].includes(hookInput.tool)) return;
      const file = hookInput.args.filePath;
      if (typeof file === 'string' && !file.endsWith('.md')) return;
      try {
        const envelope = canonicalEnvelope(hookInput, {args:hookInput.args});
        if (!envelope) return;
        const result = await dispatch(await readBoundIdentity(), {...envelope, cwd:input.directory, hook_event_name:'PostToolUse'}, directory, ['--observe-ticket']);
        if (result.exitCode === ${OBSERVED_FEATURE_BINDING} && typeof output?.output === 'string') {
          output.output += '\n\n' + featureSessionHint(hookInput.sessionID);
        }
      } catch {
        // Observation cannot reject an operation that already completed.
      }
    },
  };
};
`;
}

export function generateOpenCodeProfilePlugin(options: OpenCodeProfilePluginOptions = {}): string {
  const configured = options.markerTimeoutMilliseconds;
  const markerTimeoutMilliseconds =
    configured !== undefined && Number.isFinite(configured) && configured > 0
      ? configured
      : DEFAULT_MARKER_TIMEOUT_MILLISECONDS;
  return profilePluginSource(markerTimeoutMilliseconds);
}
