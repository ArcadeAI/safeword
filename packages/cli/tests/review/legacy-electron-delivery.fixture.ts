import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { SOULLESS_RETROSPECTIVE_POLICY as policy } from '../../src/review/retrospective-policy.js';

/** The external installed CLI is a transport fixture, never an authentic review authority. */
export function electronDeliveryFixture() {
  const temporary = mkdtempSync(path.join(tmpdir(), 'safeword-electron-delivery-'));
  const root = path.join(temporary, 'repository');
  const profile = path.join(temporary, 'profile');
  const tools = path.join(temporary, 'tools');
  const bundle = path.join(profile, 'plugins/cache/safeword/safeword/1.2.0');
  const runtime = path.join(bundle, 'runtime/cli.js');
  const log = path.join(bundle, 'calls.jsonl');
  const write = (relative: string, content: string) => {
    const target = path.join(root, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
  };
  const git = (...args: string[]) =>
    execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
  write('.safeword/version', '1.2.0\n');
  const original = (heading: string) =>
    `### Scenario: ${heading}\n- [x] RED skip: historical fixture\n- [ ] GREEN\n- [ ] REFACTOR\n`;
  write(policy.ledger, policy.scenarios.map(original).join(''));
  git('init', '-q');
  git('config', 'user.name', 'Test');
  git('config', 'user.email', 'test@example.com');
  git('config', 'commit.gpgsign', 'false');
  git('add', '.');
  git('commit', '-qm', 'historical fixture');
  const baseline = git('rev-parse', 'HEAD');
  const rows = policy.scenarios.map((scenario, index) => ({
    ticketId: policy.ticketId,
    ledger: policy.ledger,
    scenario,
    eligibilityId: '11111111-1111-4111-8111-111111111111',
    proofId: `22222222-2222-4222-8222-${String(index).padStart(12, '0')}`,
  }));
  const ledger = rows
    .map(
      row =>
        `${original(row.scenario)}- [x] VERIFIED eligibility=${row.eligibilityId} proof=${row.proofId}\n`,
    )
    .join('');
  write(policy.ledger, ledger);
  git('add', '.');
  git('commit', '-qm', 'structural verified fixture');
  mkdirSync(tools);
  mkdirSync(path.dirname(runtime), { recursive: true });
  writeFileSync(
    path.join(bundle, 'package.json'),
    JSON.stringify({ name: 'safeword-codex-plugin', version: '1.2.0', type: 'module' }),
  );
  writeFileSync(path.join(bundle, 'mode.json'), JSON.stringify('approved'));
  writeFileSync(log, '');
  writeFileSync(
    runtime,
    String.raw`
import fs from 'node:fs';
const args=process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(log)},JSON.stringify(args)+'\n');
const mode=JSON.parse(fs.readFileSync(new URL('../mode.json',import.meta.url),'utf8'));
const value=name=>args[args.indexOf(name)+1];
const close=args.includes('retrospective-close');
const data={command:'review gate '+(close?'retrospective-close':'retrospective'),status:'approved',ticketId:value('--ticket'),ledger:value('--ledger')};
if(!close) Object.assign(data,{scenario:value('--scenario'),eligibilityId:value('--eligibility'),proofId:value('--proof')});
const blocked=mode==='blocked-close'?close:['missing-row','stale-row','forged-row'].includes(mode)&&!close;
if(mode==='wrong-identity')data.ticketId='OTHER1';
if(blocked)data.status='blocked';
process.stdout.write(JSON.stringify({schema_version:1,ok:true,state:blocked?'action_required':'healthy',changed:false,findings:blocked?[{message:mode}]:[],errors:[],data}));
process.exit(blocked?2:0);
`,
  );
  const gitBinary = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();
  writeFileSync(
    path.join(tools, 'git'),
    `#!${process.execPath}
const {spawnSync}=require('node:child_process');
const cutoff=${JSON.stringify(policy.cutoff)};
const args=process.argv.slice(2).map(arg=>arg.startsWith(cutoff+':')?arg.replace(cutoff,${JSON.stringify(baseline)}):arg);
const result=spawnSync(${JSON.stringify(gitBinary)},args,{stdio:'inherit'});process.exit(result.status??1);
`,
    { mode: 0o755 },
  );
  const environment = {
    ...process.env,
    PATH: `${tools}${path.delimiter}${process.env.PATH ?? ''}`,
    CODEX_HOME: profile,
    SAFEWORD_PLUGIN_CLI: '',
    CLAUDE_PLUGIN_ROOT: '',
  };
  const script = path.resolve(
    import.meta.dirname,
    '../../scripts/verify-legacy-electron-migration.ts',
  );
  return {
    root,
    bundle,
    runtime,
    rows,
    ledger,
    write,
    git,
    environment,
    mode: (value: string) => {
      writeFileSync(path.join(bundle, 'mode.json'), JSON.stringify(value));
    },
    calls: () =>
      readFileSync(log, 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line) as string[]),
    run: (overrides: NodeJS.ProcessEnv = {}) =>
      spawnSync('bun', [script, '--project', root], {
        encoding: 'utf8',
        env: { ...environment, ...overrides },
        timeout: 30_000,
      }),
    cleanup: () => {
      rmSync(temporary, { recursive: true, force: true });
    },
  };
}
