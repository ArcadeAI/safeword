const OPEN_CODE_PROFILE_PLUGIN = `import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const profileRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const identityPath = path.join(profileRoot, 'safeword', 'identity-v1.json');
const DENIAL = 'Safeword denied this OpenCode tool call.';
const REPAIR = 'Safeword cannot run its OpenCode guard. Run safeword install --agents=opencode.';

class UnavailableDispatcher extends Error {}

function canonicalEnvelope(input, output) {
  const args = output?.args;
  if (args === null || typeof args !== 'object' || Array.isArray(args)) return undefined;
  if (input.tool === 'bash' || input.tool === 'shell') {
    if (typeof args.command !== 'string') throw new Error(DENIAL);
    return { hook_event_name: 'PreToolUse', session_id: input.sessionID, tool_name: 'Bash', tool_input: { command: args.command } };
  }
  if (input.tool === 'edit' || input.tool === 'write') {
    if (typeof args.filePath !== 'string') throw new Error(DENIAL);
    return {
      hook_event_name: 'PreToolUse',
      session_id: input.sessionID,
      tool_name: input.tool === 'edit' ? 'Edit' : 'Write',
      tool_input: { file_path: args.filePath },
    };
  }
  if (input.tool === 'patch' || input.tool === 'apply_patch') {
    if (typeof args.patchText !== 'string') throw new Error(DENIAL);
    return { hook_event_name: 'PreToolUse', session_id: input.sessionID, tool_name: 'apply_patch', tool_input: { command: args.patchText } };
  }
  return undefined;
}

async function isMarkedProject(directory) {
  try {
    await readFile(path.join(directory, '.safeword', 'SAFEWORD.md'));
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function readIdentity() {
  return JSON.parse(await readFile(identityPath, 'utf8'));
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
    if (!input?.directory || !(await isMarkedProject(input.directory))) return;
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

export function generateOpenCodeProfilePlugin(): string {
  return OPEN_CODE_PROFILE_PLUGIN;
}
