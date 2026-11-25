import assert from 'node:assert/strict';
import type * as ChildProcess from 'node:child_process';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';

import metadata from '../../package.json';
import hostReleases from '../../src/lifecycle/host-releases.json';
import { startReviewJob } from '../../src/review/job.js';
import { codexInternalCases } from '../fixtures/host-contract/native-contract-cases.js';
import {
  bundleInventory,
  codexWorkflowTemporaryBase,
} from '../helpers/codex-internal-workflows.js';
import { workflowReviewGroups } from '../helpers/codex-reviewed-workflow.js';
import { CodexWorkflowRuntimeActor } from '../helpers/codex-workflow-runtime.js';

const repo = path.resolve(import.meta.dirname, '../../../..');
const temporaryPrefix = path.join(codexWorkflowTemporaryBase(), 'codex-guard-consumer-');
const root = realpathSync(mkdtempSync(temporaryPrefix));
const digest = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
const fault = path.join(root, 'fault');
const fixtureFile = path.join(root, 'fixture.json');
const identityFile = path.join(root, 'identity.json');
const selection = { caseId: codexInternalCases()[0]?.id ?? '', arm: 'single' };
const state: {
  pair?: ReturnType<CodexWorkflowRuntimeActor['stageRevisions']>;
  fixture?: Record<string, unknown>;
  reviewId?: string;
  original?: Record<string, string>;
} = {};
function ready() {
  const { pair, fixture, reviewId, original } = state;
  assert.ok(pair && fixture && reviewId && original);
  return { pair, fixture, reviewId, original };
}

// Only native CLI/inventory and the external review worker are synthetic. The
// real actor, canonical generator, installed package, normal review job/sealed
// completion, packet capture and current receipt verifier all execute. Test-key
// reviews here are NOT independent reviews of root's future native payload.
beforeAll(async () => {
  expect(selection.caseId).not.toBe('');
  const profile = path.join(root, 'profile'),
    project = path.join(root, 'project');
  const installedPath = path.join(profile, 'plugins/cache/original');
  mkdirSync(project);
  cpSync(path.join(repo, 'packages/cli/codex-plugin'), installedPath, { recursive: true });
  writeFileSync(path.join(profile, 'auth.json'), '{}');
  writeFileSync(path.join(profile, 'config.toml'), '[hooks.state]\nsentinel="DO_NOT_TRANSFER"\n');
  const binary = path.join(root, 'vendor');
  writeFileSync(
    binary,
    String.raw`#!${process.execPath}
const fs=require('node:fs'),p=require('node:path');const args=process.argv.slice(2),profile=process.env.CODEX_HOME,base=p.dirname(profile);
const faultFile=${JSON.stringify(fault)},fault=fs.existsSync(faultFile)?fs.readFileSync(faultFile,'utf8'):'';
const installed=profile===${JSON.stringify(profile)}?${JSON.stringify(installedPath)}:p.join(profile,'plugins/cache/safeword-contract-test/safeword',${JSON.stringify(metadata.version)});
if(args.includes('--version')){console.log('codex-cli '+(fault==='version'?'0.0.0':${JSON.stringify(hostReleases.codex.version)}));process.exit(0);}
if(args.includes('marketplace')){console.log('{}');process.exit(0);}
if(args.includes('plugin')){if(args.includes('remove'))fs.rmSync(installed,{recursive:true,force:true});else fs.cpSync(p.join(base,'marketplace/plugin'),installed,{recursive:true});console.log('{}');process.exit(0);}
if(args.includes('app-server')){const rl=require('node:readline').createInterface({input:process.stdin});rl.on('line',line=>{const q=JSON.parse(line);if(q.id===1)console.log(JSON.stringify({id:1,result:{}}));if(q.id===2)console.log(JSON.stringify({id:2,result:{data:[{errors:[],warnings:[],hooks:['postToolUse','preToolUse','sessionStart','stop','userPromptSubmit'].filter(n=>fault!=='missing-event'||n!=='stop').map(eventName=>({eventName,enabled:fault!=='disabled',trustStatus:profile===${JSON.stringify(profile)}?'trusted':'untrusted',sourcePath:fault==='foreign-event'?${JSON.stringify(path.join(installedPath, 'hooks.json'))}:p.join(installed,'hooks.json')}))}]}}));});}
else if(args.includes('exec')){fs.appendFileSync(p.join(base,'actual-argv.jsonl'),JSON.stringify(args)+'\n');if(!args.includes('--dangerously-bypass-hook-trust')){console.error('ISOLATED_BEHAVIOR_FLAG_MISSING');process.exit(2);}const id='11111111-1111-4111-a111-111111111111',sessions=p.join(profile,'sessions');fs.mkdirSync(sessions,{recursive:true});fs.appendFileSync(p.join(sessions,'rollout-'+id+'.jsonl'),JSON.stringify({type:'turn_context',payload:{model:'gpt-5.6-terra'}})+'\n');console.log(JSON.stringify({type:'thread.started',thread_id:id}));console.log(JSON.stringify({type:'turn.completed'}));}
else throw Error('unexpected native request '+args);
`,
    { mode: 0o755 },
  );
  const fixture = {
    root,
    profile,
    project,
    installedPath,
    binary,
    hookManifestSha256: digest(path.join(installedPath, 'hooks.json')),
    packageManifestSha256: digest(path.join(installedPath, '.codex-plugin/plugin.json')),
  };
  const nativeVersion = spawnSync(binary, ['--version'], {
    env: { ...process.env, CODEX_HOME: profile },
    encoding: 'utf8',
  });
  expect(nativeVersion, nativeVersion.stderr).toMatchObject({
    status: 0,
    stdout: `codex-cli ${hostReleases.codex.version}\n`,
  });
  writeFileSync(fixtureFile, JSON.stringify(fixture));
  const runtimeSha256 = digest(path.join(installedPath, 'runtime/cli.js'));
  writeFileSync(
    identityFile,
    JSON.stringify({
      originalManifest: fixture.hookManifestSha256,
      runtimeSha256,
    }),
  );
  const stager = new CodexWorkflowRuntimeActor(fixtureFile, identityFile);
  const pair = stager.stageRevisions(selection);
  const bun = spawnSync(path.join(repo, 'scripts/dev'), ['bun', '-p', 'process.execPath'], {
    encoding: 'utf8',
  }).stdout.trim();
  const worker = path.join(root, 'worker.mjs');
  const completion = `import {completeReviewJob} from ${JSON.stringify(path.join(repo, 'packages/cli/src/review/job.ts'))};import * as resultFactory from ${JSON.stringify(path.join(repo, 'packages/cli/src/cli-protocol/result.ts'))};completeReviewJob(process.cwd(),process.env.SAFEWORD_REVIEW_JOB_ID,resultFactory.createResult({state:'healthy',data:{command:'review run',status:'approved',author_agent:'codex',actual_reviewer:'claude',independence:'cross-agent',reviewer_output:{schema_version:1,dispatch_id:'fake-external-worker',reviewer_agent:'claude',verdict:'approve',summary:'Actor source control only',findings:[]}}}));`;
  writeFileSync(
    worker,
    `import{spawnSync}from'node:child_process';const r=spawnSync(${JSON.stringify(bun)},['--no-env-file','-e',${JSON.stringify(completion)}],{cwd:process.cwd(),env:process.env,stdio:'inherit'});process.exit(r.status??1);`,
  );
  vi.stubEnv('SAFEWORD_REVIEW_KEY_ROOT', path.join(root, 'test-keys'));
  vi.stubEnv('XDG_STATE_HOME', path.join(root, 'test-keys'));
  vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker);
  vi.stubEnv('SAFEWORD_PLUGIN_CLI', pair.coordinator);
  const [code, raw] = workflowReviewGroups(pair);
  const job = await startReviewJob({
    cwd: pair.project,
    kind: 'quality-review',
    targets: code.targets,
    context: code.context,
  });
  expect(job.data).toMatchObject({ status: 'approved' });
  const reviewId = (job.data as { review_id: string }).review_id;
  const rawJob = await startReviewJob({
    cwd: pair.project,
    kind: 'quality-review',
    targets: raw.targets,
    context: raw.context,
  });
  expect(rawJob.data).toMatchObject({ status: 'approved' });
  const rawDeltaReviewId = (rawJob.data as { review_id: string }).review_id;
  writeFileSync(
    fixtureFile,
    JSON.stringify({
      ...fixture,
      mode: 'isolated-behavior',
      isolatedBehavior: [
        {
          ...selection,
          manifest: path.join(pair.project, 'staged-inputs.json'),
          reviewId,
          rawDeltaReviewId,
        },
      ],
    }),
  );
  Object.assign(state, { pair, fixture, reviewId, original: bundleInventory(profile) });
}, 180_000);
afterEach(() => {
  writeFileSync(fault, '');
});
afterAll(() => {
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});

async function consumer() {
  const actor = new CodexWorkflowRuntimeActor(fixtureFile, identityFile, selection);
  await actor.prepareCanonical();
  return actor;
}

vi.mock('node:child_process', async importOriginal => {
  const actual = await importOriginal<typeof ChildProcess>();
  return { ...actual, spawnSync: vi.fn(actual.spawnSync) };
});

it('uses the isolated model budget only for actual exec and resume dispatches', async () => {
  const actor = await consumer();
  vi.mocked(spawnSync).mockClear();
  actor.run('Reply briefly without tools.');
  actor.run('Reply briefly again.', true);
  const calls = vi.mocked(spawnSync).mock.calls as unknown as [
    string,
    string[],
    { timeout?: number },
  ][];
  const binary = String(ready().fixture.binary);
  const modelCalls = calls.filter(([program, args]) => program === binary && args.includes('exec'));
  expect(modelCalls, 'ISOLATED_MODEL_DISPATCH_MISSING').toHaveLength(2);
  expect(modelCalls[0]?.[1]).not.toContain('resume');
  expect(modelCalls[1]?.[1]).toContain('resume');
  expect(
    modelCalls.map(call => call[2].timeout),
    'ISOLATED_MODEL_TIMEOUT_MISMATCH',
  ).toEqual([420_000, 420_000]);
  const setupCalls = calls.filter(
    ([program, args]) => program === binary && args.includes('--version'),
  );
  expect(setupCalls.length, 'ISOLATED_SETUP_DISPATCH_MISSING').toBeGreaterThan(0);
  expect(
    setupCalls.every(call => call[2].timeout === 240_000),
    'ISOLATED_SETUP_TIMEOUT_MISMATCH',
  ).toBe(true);
  const nonModelCalls = calls.filter(
    ([program, args]) => program === binary && !args.includes('exec'),
  );
  expect(
    nonModelCalls.every(call => call[2].timeout === 240_000),
    'ISOLATED_NONMODEL_TIMEOUT_MISMATCH',
  ).toBe(true);
});

it('keeps the normal actor command timeout at its default', () => {
  const normalFixture = path.join(root, 'normal-fixture.json');
  writeFileSync(normalFixture, JSON.stringify(ready().fixture));
  const actor = new CodexWorkflowRuntimeActor(normalFixture, identityFile);
  const command = actor as unknown as {
    command(program: string, args: string[], label: string): string;
  };
  vi.mocked(spawnSync).mockClear();
  const binary = String(ready().fixture.binary);
  expect(command.command(binary, ['--version'], 'normal-version')).toContain('codex-cli');
  const calls = vi.mocked(spawnSync).mock.calls as unknown as [
    string,
    string[],
    { timeout?: number },
  ][];
  const call = calls.find(([program]) => program === binary);
  expect(call?.[2].timeout, 'NORMAL_TIMEOUT_MISMATCH').toBe(240_000);
  vi.mocked(spawnSync).mockClear();
  expect(() => command.command(binary, ['exec'], 'normal-exec')).toThrow('exit 2');
  const execCalls = vi.mocked(spawnSync).mock.calls as unknown as [
    string,
    string[],
    { timeout?: number },
  ][];
  const execCall = execCalls.find(([program, args]) => program === binary && args.includes('exec'));
  expect(execCall?.[2].timeout, 'NORMAL_EXEC_TIMEOUT_MISMATCH').toBe(240_000);
});
