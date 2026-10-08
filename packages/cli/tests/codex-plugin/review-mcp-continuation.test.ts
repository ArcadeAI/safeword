import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import readline from 'node:readline';
import { setTimeout as delay } from 'node:timers/promises';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  cleanupTrustedReviewerDirectories,
  createTrustedReviewerDirectory,
  REVIEWER_CAPABILITIES,
} from '../review-fixtures.js';

type Reviewer = 'claude' | 'codex';
const packageRoot = nodePath.resolve(import.meta.dirname, '../..');
const roots: string[] = [];
const servers: ChildProcessWithoutNullStreams[] = [];

afterEach(async () => {
  for (const server of servers.splice(0)) {
    if (server.exitCode !== null || server.signalCode !== null) continue;
    server.kill('SIGTERM');
    await new Promise<void>(resolve =>
      server.once('close', () => {
        resolve();
      }),
    );
  }
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  cleanupTrustedReviewerDirectories();
});

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function until(check: () => boolean): Promise<void> {
  const deadline = performance.now() + 10_000;
  while (!check() && performance.now() < deadline) await delay(10);
  expect(check(), 'the owned process must settle').toBe(true);
}

function vendorSource(host: string, reviewer: Reviewer, mode: string): string {
  return String.raw`#!${process.execPath}
const fs=require('node:fs');
const path=require('node:path');
const host=${JSON.stringify(host)};
const reviewer=${JSON.stringify(reviewer)};
const mode=${JSON.stringify(mode)};
const profile=process.env.${reviewer === 'claude' ? 'CLAUDE_CONFIG_DIR' : 'CODEX_HOME'};
const args=process.argv.slice(2);
if(args.includes('--help')){console.log(${JSON.stringify(REVIEWER_CAPABILITIES[reviewer])});process.exit(0);}
const status=args.includes('status');
const login=args.includes('login') && !status;
if(login || status){
  fs.appendFileSync(path.join(host,'auth-processes'),JSON.stringify({pid:process.pid,stage:status?'status':'login',profile})+'\n');
  if(login) console.log(reviewer==='claude'?'Open https://claude.com/cai/oauth/authorize?state=fixture':'Open https://auth.openai.com/codex/device\nEnter ABCD-EFGH');
  const wait=setInterval(()=>{
    if(!fs.existsSync(path.join(host,status?'release-status':'release-login')))return;
    clearInterval(wait);
    if(login){process.exit(mode==='login-failure'?7:0);}
    const ok=fs.existsSync(path.join(profile,'authenticated')) && mode!=='status-failure';
    if(reviewer==='claude') console.log(JSON.stringify({loggedIn:ok,authMethod:mode==='wrong-method'?'api_key':'claude.ai',configDirectory:mode==='wrong-directory'?host:profile}));
    else console.error(mode==='wrong-method'?'Logged in using an API key':mode==='access-token'?'Logged in using access token':ok?'Logged in using ChatGPT':'Not logged in');
    process.exit(ok?0:1);
  },5);
}else{
  let packet='';process.stdin.on('data',chunk=>{packet+=chunk});
  process.stdin.on('end',()=>{
    if(!fs.existsSync(path.join(profile,'authenticated'))){console.error('Not logged in. Please run /login');process.exit(1);}
    fs.appendFileSync(path.join(host,'paid-dispatches'),JSON.stringify({reviewer,profile,executable:process.argv[1]})+'\n');
    const dispatch= /"dispatch_id"\s*:\s*"([^"]+)"/.exec(packet)?.[1];
    const output={schema_version:1,dispatch_id:dispatch,reviewer_agent:reviewer,verdict:'approve',summary:'Reviewed.',findings:[]};
    console.log(JSON.stringify(reviewer==='claude'?{structured_output:output}:{type:'item.completed',item:{type:'agent_message',text:JSON.stringify(output)}}));
  });
}
`;
}

function client(server: ChildProcessWithoutNullStreams) {
  let nextId = 0;
  const replies = new Map<number, (value: Record<string, unknown>) => void>();
  const output = readline.createInterface({ input: server.stdout });
  output.on('line', line => {
    const response = JSON.parse(line) as { id: number; result: { content: { text: string }[] } };
    const text = response.result.content[0]?.text;
    if (text === undefined) throw new Error('MCP returned no text result');
    replies.get(response.id)?.(JSON.parse(text) as Record<string, unknown>);
    replies.delete(response.id);
  });
  server.stderr.resume();
  return (name: string, args: Record<string, unknown>) =>
    new Promise<Record<string, unknown>>((resolve, reject) => {
      const id = ++nextId;
      const timeout = setTimeout(() => {
        reject(new Error(`MCP ${name} did not respond`));
      }, 10_000);
      replies.set(id, value => {
        clearTimeout(timeout);
        resolve(value);
      });
      server.stdin.write(
        `${JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } })}\n`,
      );
    });
}

async function fixture(reviewer: Reviewer, mode = 'success', expires = false) {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-mcp-continuation-'));
  roots.push(root);
  mkdirSync(nodePath.join(root, '.safeword'));
  writeFileSync(nodePath.join(root, '.safeword/config.json'), '{}');
  writeFileSync(nodePath.join(root, 'input.md'), 'Bounded review input\n');
  const host = createTrustedReviewerDirectory('mcp-auth-');
  for (const directory of ['claude', 'codex', 'config', 'user'])
    mkdirSync(nodePath.join(host, directory));
  const bin = nodePath.join(host, 'bin');
  mkdirSync(bin);
  for (const vendor of ['claude', 'codex'] as const)
    writeFileSync(nodePath.join(bin, vendor), vendorSource(host, vendor, mode), { mode: 0o755 });
  // The external browser boundary is disabled; MCP, jobs and vendor process wiring are real.
  const preload = nodePath.join(host, 'process-boundaries.ts');
  writeFileSync(
    preload,
    `Object.defineProperty(process,'platform',{value:'simulated-host'});${expires ? 'const timer=globalThis.setTimeout;globalThis.setTimeout=((callback,ms,...args)=>timer(callback,ms===600000?250:ms,...args)) as typeof setTimeout;' : ''}`,
  );
  const server = spawn(
    'bun',
    [
      '--preload',
      preload,
      nodePath.join(packageRoot, 'src/codex-plugin/review-mcp.ts'),
      reviewer === 'claude' ? '--codex' : '--claude',
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        HOME: nodePath.join(host, 'user'),
        XDG_CONFIG_HOME: nodePath.join(host, 'config'),
        CLAUDE_CONFIG_DIR: nodePath.join(host, 'claude'),
        CODEX_HOME: nodePath.join(host, 'codex'),
        ANTHROPIC_API_KEY: '',
        CLAUDE_CODE_OAUTH_TOKEN: '',
        OPENAI_API_KEY: '',
        CODEX_API_KEY: '',
        AZURE_OPENAI_API_KEY: '',
        SAFEWORD_REVIEW_KEY_ROOT: host,
        SAFEWORD_CLI_ENTRYPOINT: nodePath.join(packageRoot, 'src/cli.ts'),
        SAFEWORD_REVIEW_CLAUDE_PATH: nodePath.join(bin, 'claude'),
        SAFEWORD_REVIEW_CODEX_PATH: nodePath.join(bin, 'codex'),
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );
  servers.push(server);
  const call = client(server);
  const started = await call('start_review', {
    project_root: root,
    kind: 'quality-review',
    targets: ['input.md'],
  });
  const id = (started.data as { review_id: string }).review_id;
  const status = () => call('review_status', { project_root: root, review_id: id });
  await vi.waitFor(
    async () => {
      const value = await status();
      expect(value.status).toBe('blocked');
    },
    { timeout: 10_000 },
  );
  const receipt = nodePath.join(root, '.safeword/state/reviews', `${id}.json`);
  const original = readFileSync(receipt);
  return {
    root,
    host,
    reviewer,
    id,
    server,
    original,
    receipt,
    status,
    call,
    login: () => call('start_reviewer_login', { project_root: root, review_id: id }),
    authenticate: () => {
      writeFileSync(nodePath.join(host, reviewer, 'authenticated'), '');
    },
    release: () => {
      writeFileSync(nodePath.join(host, 'release-login'), '');
      writeFileSync(nodePath.join(host, 'release-status'), '');
    },
    processes: () =>
      existsSync(nodePath.join(host, 'auth-processes'))
        ? readFileSync(nodePath.join(host, 'auth-processes'), 'utf8')
            .trim()
            .split('\n')
            .map(line => JSON.parse(line) as { pid: number; stage: string; profile: string })
        : [],
    receipts: () =>
      readdirSync(nodePath.join(root, '.safeword/state/reviews')).filter(name =>
        name.endsWith('.json'),
      ),
  };
}

describe('connected MCP authentication recovery', () => {
  it('finishes a signed-in review without another start or retry command', async () => {
    const review = await fixture('claude');
    await review.login();
    review.authenticate();
    review.release();
    await vi.waitFor(
      async () => {
        const status = await review.status();
        expect(status.status, 'signed-in review must resume without another tool call').toBe(
          'approved',
        );
      },
      { timeout: 10_000 },
    );
    expect(review.receipts()).toHaveLength(2);
    expect(readFileSync(review.receipt)).toEqual(review.original);
    expect(
      readFileSync(nodePath.join(review.host, 'paid-dispatches'), 'utf8').trim().split('\n'),
    ).toHaveLength(1);
  });

  it('retains manual recovery for a signed legacy receipt without a profile binding', async () => {
    const review = await fixture('claude');
    const record = JSON.parse(readFileSync(review.receipt, 'utf8')) as Record<string, unknown>;
    delete record.authentication_bindings;
    delete record.integrity;
    const keyPath = nodePath.join(review.host, 'safeword/review-integrity.key');
    const key = Buffer.from(readFileSync(keyPath, 'utf8').trim(), 'hex');
    record.integrity = createHmac('sha256', key)
      .update(realpathSync.native(review.root))
      .update('\0')
      .update(JSON.stringify(record))
      .digest('hex');
    writeFileSync(review.receipt, JSON.stringify(record));
    const legacy = readFileSync(review.receipt);
    const login = await review.login();
    expect(login.message).toEqual(expect.stringContaining('Retry'));
    expect(login.automatic_resume_allowed).not.toBe(true);
    review.authenticate();
    review.release();
    const owned = review.processes()[0];
    if (owned === undefined) throw new Error('Legacy login did not start');
    await until(() => !alive(owned.pid));
    await delay(100);
    const status = await review.status();
    expect(status.status).toBe('blocked');
    expect(review.receipts()).toHaveLength(1);
    expect(readFileSync(review.receipt)).toEqual(legacy);
    expect(existsSync(nodePath.join(review.host, 'paid-dispatches'))).toBe(false);
  });

  it.each(['claude', 'codex'] as const)(
    'resumes %s through stdio without another message or an open panel',
    async reviewer => {
      const review = await fixture(reviewer);
      const login = await review.login();
      expect(login.message).toEqual(expect.stringContaining('automatically'));
      review.authenticate();
      review.release();
      await vi.waitFor(
        async () => {
          const status = await review.status();
          expect(status.status, 'signed-in review must resume without another tool call').toBe(
            'approved',
          );
        },
        { timeout: 10_000 },
      );
      expect(review.receipts()).toHaveLength(2);
      expect(readFileSync(review.receipt)).toEqual(review.original);
      const dispatches = readFileSync(nodePath.join(review.host, 'paid-dispatches'), 'utf8')
        .trim()
        .split('\n')
        .map(line => JSON.parse(line) as { profile: string; executable: string });
      expect(dispatches).toEqual([
        {
          reviewer,
          profile: nodePath.join(review.host, reviewer),
          executable: nodePath.join(review.host, 'bin', reviewer),
        },
      ]);
      const retryName = review.receipts().find(name => name !== `${review.id}.json`);
      if (retryName === undefined) throw new Error('No linked retry receipt');
      const retryFile = nodePath.join(review.root, '.safeword/state/reviews', retryName);
      const retry = JSON.parse(readFileSync(retryFile, 'utf8')) as Record<string, unknown>;
      expect(retry).toMatchObject({ retry_of: review.id });
    },
  );

  it.each([
    ['claude', 'status-failure'],
    ['codex', 'status-failure'],
    ['claude', 'wrong-method'],
    ['claude', 'wrong-directory'],
    ['codex', 'wrong-method'],
    ['codex', 'access-token'],
    ['claude', 'login-failure'],
    ['codex', 'login-failure'],
  ] as const)('does not dispatch for %s %s', async (reviewer, mode) => {
    const review = await fixture(reviewer, mode);
    await review.login();
    review.authenticate();
    review.release();
    await vi.waitFor(
      async () => {
        const status = await review.status();
        expect(status.authentication_recovery).toMatchObject({ status: 'manual_retry_required' });
      },
      { timeout: 10_000 },
    );
    expect(review.receipts()).toHaveLength(1);
    expect(existsSync(nodePath.join(review.host, 'paid-dispatches'))).toBe(false);
    expect(readFileSync(review.receipt)).toEqual(review.original);
  });

  it('rejects source changes while the authentication check is paused', async () => {
    const review = await fixture('claude');
    await review.login();
    review.authenticate();
    writeFileSync(nodePath.join(review.host, 'release-login'), '');
    await until(() => review.processes().some(owned => owned.stage === 'status'));
    writeFileSync(nodePath.join(review.root, 'input.md'), 'Changed during authentication\n');
    writeFileSync(nodePath.join(review.host, 'release-status'), '');
    await vi.waitFor(
      async () => {
        const status = await review.status();
        expect(status.authentication_recovery).toMatchObject({ status: 'manual_retry_required' });
      },
      { timeout: 10_000 },
    );
    expect(review.receipts()).toHaveLength(1);
    expect(existsSync(nodePath.join(review.host, 'paid-dispatches'))).toBe(false);
  });

  it.each([
    ['EOF', 'login'],
    ['SIGTERM', 'login'],
    ['EOF', 'status'],
    ['SIGTERM', 'status'],
  ] as const)('terminates the owned process on %s during %s', async (shutdown, stage) => {
    const review = await fixture('claude');
    await review.login();
    review.authenticate();
    if (stage === 'status') writeFileSync(nodePath.join(review.host, 'release-login'), '');
    await until(() => review.processes().some(owned => owned.stage === stage));
    const owned = review.processes().find(item => item.stage === stage);
    if (owned === undefined) throw new Error('Owned process did not start');
    if (shutdown === 'EOF') review.server.stdin.end();
    else review.server.kill('SIGTERM');
    await until(() => !alive(owned.pid));
    review.release();
    await delay(100);
    expect(review.receipts()).toHaveLength(1);
    expect(existsSync(nodePath.join(review.host, 'paid-dispatches'))).toBe(false);
  });

  it('expires a connected login before a late successful release', async () => {
    const review = await fixture('claude', 'success', true);
    await review.login();
    review.authenticate();
    const owned = review.processes()[0];
    if (owned === undefined) throw new Error('Login did not start');
    await until(() => !alive(owned.pid));
    review.release();
    await delay(100);
    const status = await review.status();
    expect(status.authentication_recovery).toMatchObject({ status: 'manual_retry_required' });
    expect(review.receipts()).toHaveLength(1);
    expect(existsSync(nodePath.join(review.host, 'paid-dispatches'))).toBe(false);
  });
});
