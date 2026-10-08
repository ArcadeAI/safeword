import { spawn, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { setTimeout as delay } from 'node:timers/promises';

import {
  cleanupTrustedReviewerDirectories,
  createTrustedReviewerDirectory,
  REVIEWER_CAPABILITIES,
} from '../review-fixtures.js';

// Real stdio and signed store; synthetic vendor CLIs and a disabled browser boundary.
const packageRoot = path.resolve(import.meta.dirname, '../..');
const nodeExecutable = spawnSync('node', ['-p', 'process.execPath'], {
  encoding: 'utf8',
}).stdout.trim();
if (!path.isAbsolute(nodeExecutable)) throw new Error('Node fixture runtime must be available');
const failures: Error[] = [];
for (const reviewer of ['claude', 'codex'] as const) {
  const root = mkdtempSync(path.join(tmpdir(), 'safeword-auth-mcp-proof-'));
  const host = createTrustedReviewerDirectory('auth-mcp-proof-');
  for (const directory of ['claude', 'codex', 'bin', 'user', 'config'])
    mkdirSync(path.join(host, directory));
  for (const vendor of ['claude', 'codex']) {
    const defaultProfile = path.join(host, 'user', `.${vendor}`);
    mkdirSync(defaultProfile);
    writeFileSync(path.join(defaultProfile, 'authenticated'), '');
  }
  mkdirSync(path.join(root, '.safeword'));
  writeFileSync(
    path.join(root, '.safeword/config.json'),
    JSON.stringify({
      crossAgentReviewRoutes: { [reviewer === 'claude' ? 'codex' : 'claude']: [{ reviewer }] },
    }),
  );
  writeFileSync(path.join(root, 'input.md'), 'Original request\n');
  for (const vendor of ['claude', 'codex'] as const) {
    writeFileSync(
      path.join(host, 'bin', vendor),
      String.raw`#!${nodeExecutable}
const fs=require('node:fs');
const host=${JSON.stringify(host)}, vendor=${JSON.stringify(vendor)};
const profile=process.env.${vendor === 'claude' ? 'CLAUDE_CONFIG_DIR' : 'CODEX_HOME'};
const args=process.argv.slice(2);
if(args.includes('--help')){console.log(${JSON.stringify(REVIEWER_CAPABILITIES[vendor])});process.exit(0)}
if(args.includes('login')||args.includes('status')){
  if(args.includes('status')){
    if(vendor==='claude') console.log(JSON.stringify({loggedIn:true,authMethod:'claude.ai',configDirectory:profile}));
    else console.error('Logged in using ChatGPT');
    process.exit(fs.existsSync(profile+'/authenticated')?0:1);
  }
  console.log(vendor==='claude'?'Open https://claude.com/cai/oauth/authorize?state=fixture':'Open https://auth.openai.com/codex/device\nEnter ABCD-EFGH');
  const timer=setInterval(()=>{if(fs.existsSync(host+'/release-login')){clearInterval(timer);process.exit(0)}},5);
}else{
  let packet='';process.stdin.on('data',chunk=>packet+=chunk);
  process.stdin.on('end',()=>{
    if(!fs.existsSync(profile+'/authenticated')){console.error('Not logged in. Please run /login');process.exit(1)}
    fs.appendFileSync(host+'/dispatches',JSON.stringify({vendor,profile,executable:process.argv[1]})+'\n');
    const dispatch= /"dispatch_id"\s*:\s*"([^"]+)"/.exec(packet)?.[1];
    const output={schema_version:1,dispatch_id:dispatch,reviewer_agent:vendor,verdict:'approve',summary:'Synthetic vendor contract.',findings:[]};
    console.log(JSON.stringify(vendor==='claude'?{structured_output:output}:{type:'item.completed',item:{type:'agent_message',text:JSON.stringify(output)}}));
  });
}
`,
      { mode: 0o755 },
    );
  }
  const preload = path.join(host, 'browser-boundary.ts');
  writeFileSync(
    preload,
    `import {mock} from 'bun:test';mock.module(${JSON.stringify(path.join(packageRoot, 'src/codex-plugin/reviewer-browser.ts'))},()=>({requestBrowserOpen:async()=>false}));`,
  );
  const server = spawn(
    process.execPath,
    [
      '--preload',
      preload,
      path.join(packageRoot, 'src/codex-plugin/review-mcp.ts'),
      reviewer === 'claude' ? '--codex' : '--claude',
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PATH: `${path.join(host, 'bin')}:/usr/bin:/bin`,
        HOME: path.join(host, 'user'),
        XDG_CONFIG_HOME: path.join(host, 'config'),
        CLAUDE_CONFIG_DIR: path.join(host, 'claude'),
        CODEX_HOME: path.join(host, 'codex'),
        ANTHROPIC_API_KEY: '',
        CLAUDE_CODE_OAUTH_TOKEN: '',
        OPENAI_API_KEY: '',
        CODEX_API_KEY: '',
        AZURE_OPENAI_API_KEY: '',
        SAFEWORD_REVIEW_KEY_ROOT: host,
        SAFEWORD_CLI_ENTRYPOINT: path.join(packageRoot, 'src/cli.ts'),
        SAFEWORD_REVIEW_CLAUDE_PATH: path.join(host, 'bin/claude'),
        SAFEWORD_REVIEW_CODEX_PATH: path.join(host, 'bin/codex'),
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );
  server.stderr.resume();
  let nextId = 0;
  const pending = new Map<number, (result: Record<string, unknown>) => void>();
  const lines = readline.createInterface({ input: server.stdout });
  lines.on('line', line => {
    const response = JSON.parse(line) as { id?: number; result?: { content?: { text: string }[] } };
    if (response.id === undefined) return;
    const text = response.result?.content?.[0]?.text;
    if (text === undefined) throw new Error('MCP must return a typed result');
    pending.get(response.id)?.(JSON.parse(text) as Record<string, unknown>);
    pending.delete(response.id);
  });
  const call = (name: string, args: Record<string, unknown>) =>
    new Promise<Record<string, unknown>>((resolve, reject) => {
      const id = ++nextId;
      const timeout = setTimeout(() => {
        reject(new Error('MCP response must settle'));
      }, 10_000);
      pending.set(id, result => {
        clearTimeout(timeout);
        resolve(result);
      });
      server.stdin.write(
        `${JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } })}\n`,
      );
    });
  try {
    const started = await call('start_review', {
      project_root: root,
      kind: 'quality-review',
      targets: ['input.md'],
    });
    const id = (started.data as { review_id: string }).review_id;
    const status = () => call('review_status', { project_root: root, review_id: id });
    let value = await status();
    const originalDeadline = Date.now() + 10_000;
    while (value.status !== 'blocked') {
      if (value.status !== 'pending')
        throw new Error(
          `original returned ${String(value.status)}: ${JSON.stringify((value.result as { errors?: unknown }).errors)}`,
        );
      if (Date.now() >= originalDeadline)
        throw new Error('original must reach authentication-required state');
      await delay(10);
      value = await status();
    }
    const directory = path.join(root, '.safeword/state/reviews');
    const receipt = path.join(directory, `${id}.json`);
    const original = readFileSync(receipt);
    const login = await call('start_reviewer_login', { project_root: root, review_id: id });
    if (login.reviewer !== reviewer || typeof login.auth_url !== 'string')
      throw new Error('assigned reviewer login must start before release');
    writeFileSync(path.join(host, reviewer, 'authenticated'), '');
    writeFileSync(path.join(host, 'release-login'), '');
    const deadline = Date.now() + 5000;
    while (value.status !== 'approved' && Date.now() < deadline) {
      value = await status();
      await delay(10);
    }
    if (value.status !== 'approved')
      throw new Error('signed-in review must resume without another tool call');
    if (!readFileSync(receipt).equals(original))
      throw new Error('original receipt must stay byte-identical');
    if (readdirSync(directory).filter(name => name.endsWith('.json')).length !== 2)
      throw new Error('one retry receipt must exist');
    const dispatches = readFileSync(path.join(host, 'dispatches'), 'utf8')
      .trim()
      .split('\n')
      .map(line => JSON.parse(line) as { vendor: string; profile: string; executable: string });
    if (
      dispatches.length !== 1 ||
      dispatches[0]?.vendor !== reviewer ||
      dispatches[0]?.profile !== path.join(host, reviewer) ||
      dispatches[0]?.executable !== path.join(host, 'bin', reviewer)
    )
      throw new Error('retry must use the assigned vendor, executable, and profile');
    if (
      (value.result as { data: { reviewer_output: { reviewer_agent: string } } }).data
        .reviewer_output.reviewer_agent !== reviewer
    )
      throw new Error('signed verdict must identify the assigned reviewer');
    const actualId = (value.result as { data: { review_id: string } }).data.review_id;
    const child = JSON.parse(readFileSync(path.join(directory, `${actualId}.json`), 'utf8')) as {
      retry_of: string;
    };
    if (child.retry_of !== id) throw new Error('retry must link to original');
    if (
      !existsSync(path.join(host, 'dispatches')) ||
      readFileSync(path.join(host, 'dispatches'), 'utf8').trim().split('\n').length !== 1
    )
      throw new Error('one reviewer must dispatch');
    console.log(`PASS: ${reviewer} resumes through stdio with one linked verdict`);
  } catch (error) {
    failures.push(
      new Error(`${reviewer}: ${error instanceof Error ? error.message : 'proof failed'}`),
    );
  } finally {
    if (server.exitCode === null && server.signalCode === null) {
      server.kill('SIGTERM');
      await new Promise<void>(resolve =>
        server.once('close', () => {
          resolve();
        }),
      );
    }
    lines.close();
    rmSync(root, { recursive: true, force: true });
    cleanupTrustedReviewerDirectories();
  }
}
if (failures.length > 0)
  throw new AggregateError(failures, 'MCP authentication continuation proof failed');
