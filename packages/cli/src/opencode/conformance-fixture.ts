import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { CURSOR_COMMAND_WRAPPERS } from '../cursor-wrappers.js';
import { getTemplatesDirectory } from '../utils/fs.js';
import { renderOpenCodeAgent, renderOpenCodeCommand, SAFEWORD_SUBAGENTS } from './catalogue.js';
import { type OpenCodeIdentityV1 } from './identity.js';
import { openCodeProfilePaths } from './profile.js';

export const OPENCODE_EXPECTED_DISCOVERY = {
  command: 'bdd',
  subagent: 'safeword-reviewer',
  skill: 'bdd',
} as const;

export type OpenCodeConformanceFault =
  'missing-command' | 'missing-subagent' | 'missing-skill' | 'disarmed-denial';

interface ProcessResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface OpenCodeDenialProof {
  readonly denialSurfaced: boolean;
  readonly sentinelAbsent: boolean;
}

export interface OpenCodeSkillProof {
  readonly argumentsObserved: boolean;
  readonly canonicalBodyObserved: boolean;
}

export interface OpenCodeConformanceProfile {
  readonly dispatcherBytes: Buffer;
  readonly identity: OpenCodeIdentityV1;
  readonly pluginBytes: Buffer;
}

function skillBody(content: string): string {
  const frontmatterEnd = content.indexOf('\n---\n', 4);
  if (frontmatterEnd === -1) throw new Error('Canonical skill frontmatter is incomplete');
  return content.slice(frontmatterEnd + 5).trim();
}

function prepareCatalogueFixture(
  root: string,
  profile: OpenCodeConformanceProfile,
  fault?: OpenCodeConformanceFault,
): string {
  const project = nodePath.join(root, 'project');
  const config = nodePath.join(root, 'config');
  const command = CURSOR_COMMAND_WRAPPERS.find(candidate => candidate.name === 'bdd');
  const agent = SAFEWORD_SUBAGENTS.find(candidate => candidate.name === 'safeword-reviewer');
  if (command === undefined || agent === undefined) {
    throw new Error('Safeword OpenCode catalogue fixture is incomplete');
  }
  const skillPath = nodePath.join(getTemplatesDirectory(), 'skills', 'bdd', 'SKILL.md');

  mkdirSync(nodePath.join(project, '.opencode', 'commands'), { recursive: true });
  mkdirSync(nodePath.join(project, '.opencode', 'agents'), { recursive: true });
  mkdirSync(nodePath.join(project, '.claude', 'skills', 'bdd'), { recursive: true });
  mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
  cpSync(
    nodePath.join(getTemplatesDirectory(), 'hooks'),
    nodePath.join(project, '.safeword', 'hooks'),
    { recursive: true },
  );
  if (fault !== 'missing-command') {
    writeFileSync(
      nodePath.join(project, '.opencode', 'commands', 'bdd.md'),
      renderOpenCodeCommand(command),
    );
  }
  if (fault !== 'missing-subagent') {
    writeFileSync(
      nodePath.join(project, '.opencode', 'agents', 'safeword-reviewer.md'),
      renderOpenCodeAgent(agent),
    );
  }
  if (fault !== 'missing-skill') {
    writeFileSync(
      nodePath.join(project, '.claude', 'skills', 'bdd', 'SKILL.md'),
      readFileSync(skillPath),
    );
  }
  writeFileSync(nodePath.join(project, '.safeword', 'SAFEWORD.md'), '# Safeword\n');
  const profilePaths = openCodeProfilePaths(config);
  mkdirSync(nodePath.dirname(profilePaths.plugin), { recursive: true });
  mkdirSync(profilePaths.safeword, { recursive: true });
  writeFileSync(profilePaths.plugin, profile.pluginBytes);
  writeFileSync(profilePaths.dispatcher, profile.dispatcherBytes);
  writeFileSync(
    profilePaths.identity,
    `${JSON.stringify({ ...profile.identity, dispatcher_path: profilePaths.dispatcher })}\n`,
  );
  return project;
}

function runHost(
  executable: string,
  args: readonly string[],
  cwd: string,
  environment: NodeJS.ProcessEnv,
) {
  return spawnSync(executable, args, {
    cwd,
    encoding: 'utf8',
    env: environment,
    maxBuffer: 10 * 1024 * 1024,
    timeout: 30_000,
  });
}

function runHostAsync(
  executable: string,
  args: readonly string[],
  cwd: string,
  environment: NodeJS.ProcessEnv,
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd,
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('OpenCode conformance fixture timed out'));
    }, 30_000);
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk));
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));
    child.once('error', reject);
    child.once('close', exitCode => {
      clearTimeout(timeout);
      resolve({ exitCode: exitCode ?? -1, stdout, stderr });
    });
  });
}

function sse(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function toolResponse(name: string, args: unknown, id: string): string {
  return [
    sse({
      id: 'chatcmpl-safeword',
      object: 'chat.completion.chunk',
      choices: [{ delta: { role: 'assistant' } }],
    }),
    sse({
      id: 'chatcmpl-safeword',
      object: 'chat.completion.chunk',
      choices: [
        {
          delta: {
            tool_calls: [
              {
                index: 0,
                id,
                type: 'function',
                function: { name, arguments: JSON.stringify(args) },
              },
            ],
          },
        },
      ],
    }),
    sse({
      id: 'chatcmpl-safeword',
      object: 'chat.completion.chunk',
      choices: [{ delta: {}, finish_reason: 'tool_calls' }],
    }),
    'data: [DONE]\n\n',
  ].join('');
}

function stopResponse(): string {
  return [
    sse({
      id: 'chatcmpl-safeword',
      object: 'chat.completion.chunk',
      choices: [{ delta: { role: 'assistant', content: 'done' } }],
    }),
    sse({
      id: 'chatcmpl-safeword',
      object: 'chat.completion.chunk',
      choices: [{ delta: {}, finish_reason: 'stop' }],
    }),
    'data: [DONE]\n\n',
  ].join('');
}

function loopbackServer(command: string) {
  let emitted = false;
  return createServer((request, response) => {
    let raw = '';
    request.setEncoding('utf8');
    request.on('data', (chunk: string) => (raw += chunk));
    request.on('end', () => {
      const title = raw.includes('Generate a title for this conversation');
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      if (title || emitted) response.end(stopResponse());
      else {
        emitted = true;
        response.end(toolResponse('bash', { command }, 'call_safeword_denial'));
      }
    });
  });
}

function skillLoopbackServer(
  exactArguments: string,
  canonicalBody: string,
  observation: { argumentsObserved: boolean; canonicalBodyObserved: boolean },
) {
  let requested = false;
  const encodedBody = JSON.stringify(canonicalBody).slice(1, -1);
  return createServer((request, response) => {
    let raw = '';
    request.setEncoding('utf8');
    request.on('data', (chunk: string) => (raw += chunk));
    request.on('end', () => {
      const title = raw.includes('Generate a title for this conversation');
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      if (title) {
        response.end(stopResponse());
      } else if (requested) {
        observation.canonicalBodyObserved = raw.includes(encodedBody);
        response.end(stopResponse());
      } else {
        requested = true;
        observation.argumentsObserved = raw.includes(exactArguments);
        response.end(toolResponse('skill', { name: 'bdd' }, 'call_safeword_skill'));
      }
    });
  });
}

function writeLoopbackConfig(project: string, baseURL: string): void {
  writeFileSync(
    nodePath.join(project, 'opencode.json'),
    JSON.stringify({
      formatter: false,
      lsp: false,
      provider: {
        test: {
          name: 'Test',
          id: 'test',
          env: [],
          npm: '@ai-sdk/openai-compatible',
          models: {
            'test-model': {
              id: 'test-model',
              name: 'Test Model',
              tool_call: true,
              limit: { context: 100_000, output: 10_000 },
            },
          },
          options: { apiKey: 'test-key', baseURL },
        },
      },
    }),
  );
}

function fixtureEnvironment(root: string, environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    ...environment,
    PATH: `${nodePath.join(root, 'bin')}${nodePath.delimiter}${environment.PATH ?? ''}`,
    HOME: nodePath.join(root, 'home'),
    XDG_CONFIG_HOME: nodePath.join(root, 'xdg-config'),
    XDG_DATA_HOME: nodePath.join(root, 'xdg-data'),
    XDG_CACHE_HOME: nodePath.join(root, 'xdg-cache'),
    OPENCODE_CONFIG_DIR: nodePath.join(root, 'config'),
    OPENCODE_DISABLE_AUTOUPDATE: 'true',
  };
}

export function proveOpenCodeCatalogue(
  executable: string,
  environment: NodeJS.ProcessEnv,
  profile: OpenCodeConformanceProfile,
  fault?: OpenCodeConformanceFault,
): boolean {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-opencode-conformance-'));
  try {
    const project = prepareCatalogueFixture(root, profile, fault);
    const isolatedEnvironment = fixtureEnvironment(root, environment);
    const config = runHost(executable, ['debug', 'config'], project, isolatedEnvironment);
    const skills = runHost(executable, ['debug', 'skill'], project, isolatedEnvironment);
    if (config.status !== 0 || skills.status !== 0) return false;
    const resolved = JSON.parse(config.stdout) as {
      command?: Record<string, unknown>;
      agent?: Record<string, unknown>;
    };
    const discoveredSkills = JSON.parse(skills.stdout) as { name?: unknown }[];
    return (
      resolved.command?.[OPENCODE_EXPECTED_DISCOVERY.command] !== undefined &&
      resolved.agent?.[OPENCODE_EXPECTED_DISCOVERY.subagent] !== undefined &&
      discoveredSkills.some(skill => skill.name === OPENCODE_EXPECTED_DISCOVERY.skill)
    );
  } catch {
    return false;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

interface SentinelExecution {
  readonly output: string;
  readonly sentinelExists: boolean;
}

async function executeSentinelFixture(
  executable: string,
  environment: NodeJS.ProcessEnv,
  profile: OpenCodeConformanceProfile,
  mode: 'allow' | 'control' | 'denial',
): Promise<SentinelExecution> {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-opencode-conformance-'));
  const project = prepareCatalogueFixture(root, profile);
  if (mode === 'control') rmSync(nodePath.join(root, 'config', 'plugins', 'safeword.js'));
  const nonce = randomUUID();
  const sentinel = nodePath.join(project, `${mode}-${nonce}`);
  const command =
    mode === 'allow'
      ? `touch ${JSON.stringify(sentinel)}`
      : `touch ${JSON.stringify(sentinel)} && pkill node`;
  const fakePkill = nodePath.join(root, 'bin', 'pkill');
  mkdirSync(nodePath.dirname(fakePkill), { recursive: true });
  writeFileSync(fakePkill, '#!/bin/sh\nexit 0\n');
  chmodSync(fakePkill, 0o755);
  const server = loopbackServer(command);
  try {
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') {
      return { output: '', sentinelExists: existsSync(sentinel) };
    }
    writeLoopbackConfig(project, `http://127.0.0.1:${address.port}/v1`);
    const execution = await runHostAsync(
      executable,
      [
        'run',
        'exercise the Safeword denial fixture',
        '--model',
        'test/test-model',
        '--dir',
        project,
        '--auto',
        '--print-logs',
        '--log-level',
        'DEBUG',
      ],
      project,
      fixtureEnvironment(root, environment),
    );
    return { output: execution.stdout + execution.stderr, sentinelExists: existsSync(sentinel) };
  } catch {
    return { output: '', sentinelExists: existsSync(sentinel) };
  } finally {
    server.close();
    rmSync(root, { recursive: true, force: true });
  }
}

export async function proveOpenCodeDenial(
  executable: string,
  environment: NodeJS.ProcessEnv,
  profile: OpenCodeConformanceProfile,
  armed = true,
): Promise<OpenCodeDenialProof> {
  const execution = await executeSentinelFixture(
    executable,
    environment,
    profile,
    armed ? 'denial' : 'control',
  );
  return {
    denialSurfaced: execution.output.includes('Safeword denied this OpenCode tool call.'),
    sentinelAbsent: !execution.sentinelExists,
  };
}

export async function proveOpenCodeAllow(
  executable: string,
  environment: NodeJS.ProcessEnv,
  profile: OpenCodeConformanceProfile,
): Promise<boolean> {
  const execution = await executeSentinelFixture(executable, environment, profile, 'allow');
  return execution.sentinelExists;
}

export async function proveOpenCodeControl(
  executable: string,
  environment: NodeJS.ProcessEnv,
  profile: OpenCodeConformanceProfile,
): Promise<boolean> {
  const execution = await executeSentinelFixture(executable, environment, profile, 'control');
  return execution.sentinelExists;
}

export async function proveOpenCodeSkillInvocation(
  executable: string,
  environment: NodeJS.ProcessEnv,
  profile: OpenCodeConformanceProfile,
): Promise<OpenCodeSkillProof> {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-opencode-conformance-'));
  const project = prepareCatalogueFixture(root, profile);
  const exactArguments = `fixture-token=${randomUUID()}`;
  const canonicalBody = skillBody(
    readFileSync(nodePath.join(project, '.claude', 'skills', 'bdd', 'SKILL.md'), 'utf8'),
  );
  const observation = { argumentsObserved: false, canonicalBodyObserved: false };
  const server = skillLoopbackServer(exactArguments, canonicalBody, observation);
  try {
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') return observation;
    writeLoopbackConfig(project, `http://127.0.0.1:${address.port}/v1`);
    await runHostAsync(
      executable,
      [
        'run',
        `/bdd ${exactArguments}`,
        '--model',
        'test/test-model',
        '--dir',
        project,
        '--auto',
        '--print-logs',
        '--log-level',
        'DEBUG',
      ],
      project,
      fixtureEnvironment(root, environment),
    );
    return observation;
  } catch {
    return observation;
  } finally {
    server.close();
    rmSync(root, { recursive: true, force: true });
  }
}
