import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import { promisify } from 'node:util';

import type { OpenCodeTurnInput } from './opencode-native-driver.js';

const execute = promisify(execFile);

/** The CLI exposes command execution through its public api command, not run's text prompt. */
export async function runOpenCodeCommand(input: OpenCodeTurnInput) {
  assert.ok(input.command);
  const environment = {
    ...input.environment,
    OPENCODE_PASSWORD: randomUUID(),
  };
  const server = spawn(input.binary, ['serve', '--hostname', '127.0.0.1', '--port', '0'], {
    cwd: input.project,
    env: environment,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  const exited = new Promise(resolve => server.once('close', resolve));
  server.stdout.setEncoding('utf8').on('data', (chunk: string) => {
    stdout += chunk;
  });
  server.stderr.setEncoding('utf8').on('data', (chunk: string) => {
    stderr += chunk;
  });
  try {
    const url = await new Promise<string>((resolve, reject) => {
      const timeout = AbortSignal.timeout(15_000);
      const expired = () => {
        reject(new Error('HOST_CONTRACT_PROOF_UNAVAILABLE: command server did not start'));
      };
      timeout.addEventListener('abort', expired, { once: true });
      const readAddress = () => {
        const address = /http:\/\/127\.0\.0\.1:\d+/u.exec(stdout)?.[0];
        if (address) {
          timeout.removeEventListener('abort', expired);
          resolve(address);
        }
      };
      server.stdout.on('data', readAddress);
      server.once('error', error => {
        timeout.removeEventListener('abort', expired);
        reject(error);
      });
      server.once('exit', () => {
        timeout.removeEventListener('abort', expired);
        reject(new Error(`HOST_CONTRACT_PROOF_UNAVAILABLE: command server exited: ${stderr}`));
      });
      readAddress();
    });
    async function api(operation: string, args: string[] = []) {
      return execute(input.binary, ['api', '--server', url, operation, ...args], {
        cwd: input.project,
        env: environment,
        timeout: 60_000,
        maxBuffer: 4 * 1024 * 1024,
      });
    }
    const created = await api('session.create', [
      '--data',
      JSON.stringify({
        location: { directory: input.project },
        model: { providerID: 'fixture', id: 'model' },
        permissions: [{ action: '*', resource: '*', effect: 'allow' }],
      }),
    ]);
    writeFileSync(nodePath.join(input.directory, 'native-command-session.json'), created.stdout);
    const session = (JSON.parse(created.stdout) as { data: { id: string } }).data;
    assert.ok(session.id);
    let missing = false;
    try {
      const invoked = await api('session.command', [
        '--param',
        `sessionID=${session.id}`,
        '--data',
        JSON.stringify({ name: input.command, text: input.prompt ?? '' }),
      ]);
      writeFileSync(
        nodePath.join(input.directory, 'native-command-invocation.json'),
        invoked.stdout,
      );
    } catch (error) {
      const failure = error as { stdout?: string; stderr?: string };
      const output = `${failure.stdout ?? ''}${failure.stderr ?? ''}`;
      const rejected = JSON.parse(failure.stdout ?? '{}') as { _tag?: string; command?: string };
      if (rejected._tag !== 'CommandNotFoundError' || rejected.command !== input.command)
        throw error;
      missing = true;
      writeFileSync(nodePath.join(input.directory, 'native-command-invocation.json'), output);
    }
    const registration = await api('plugin.list', ['--param', `directory=${input.project}`]);
    writeFileSync(
      nodePath.join(input.directory, 'native-command-registration.json'),
      registration.stdout,
    );
    if (!missing) {
      await api('experimental.session.wait', ['--param', `sessionID=${session.id}`]);
      const messages = await api('message.list', ['--param', `sessionID=${session.id}`]);
      writeFileSync(
        nodePath.join(input.directory, 'native-command-messages.json'),
        messages.stdout,
      );
    }
    writeFileSync(
      nodePath.join(input.directory, 'native-command-result.json'),
      JSON.stringify({ sessionID: session.id, missing }),
    );
    return { stdout, stderr, code: 0 };
  } finally {
    server.kill('SIGTERM');
    const timer = setTimeout(() => server.kill('SIGKILL'), 5000);
    await exited;
    clearTimeout(timer);
    writeFileSync(nodePath.join(input.directory, 'native-command-server.log'), stdout + stderr);
  }
}
