import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
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

it('runs only after exact reviewed installation and records the real explicit-mode argv', async () => {
  const { pair } = ready();
  const actor = await consumer();
  try {
    actor.run('Reply briefly without tools.');
  } catch (error) {
    const stderr = path.join(actor.artifacts, 'turn-1.stderr');
    if (existsSync(stderr)) console.error(readFileSync(stderr, 'utf8'));
    throw error;
  }
  const args = JSON.parse(
    readFileSync(path.join(actor.artifacts, 'actual-argv.jsonl'), 'utf8').trim(),
  );
  expect(args).toContain('--dangerously-bypass-hook-trust');
  expect(args).not.toContain('--dangerously-bypass-approvals-and-sandbox');
  const actual = JSON.parse(
    readFileSync(path.join(actor.artifacts, 'turn-1-isolated-mode.json'), 'utf8'),
  );
  expect(actual).toMatchObject({
    mode: 'isolated-behavior',
    admissionEligible: false,
    coordinatorSha256: pair.coordinatorSha256,
  });
  expect(actual.hooks).toHaveLength(5);
  expect(actual.hooks.every((h: { trustStatus: string }) => h.trustStatus === 'untrusted')).toBe(
    true,
  );
});

it.each(['version', 'missing-event', 'disabled', 'foreign-event'])(
  'refuses %s before any behavior argv',
  async faultName => {
    const actor = await consumer();
    writeFileSync(fault, faultName);
    const file = path.join(actor.artifacts, 'actual-argv.jsonl');
    expect(() => actor.run('Ordinary next action.')).toThrow();
    expect(existsSync(file)).toBe(false);
  },
);

it('refuses actual frozen package drift before dispatch', async () => {
  const { pair } = ready();
  const actor = await consumer();
  const a = pair.stages[0];
  assert.ok(a);
  const file = path.join(a.packageRoot, 'runtime/cli.js'),
    before = readFileSync(file);
  try {
    writeFileSync(file, 'changed');
    expect(() => actor.run('Ordinary task.')).toThrow('isolated workflow');
  } finally {
    writeFileSync(file, before);
  }
});

it('refuses a missing authenticated review before native setup', () => {
  const { fixture, pair } = ready();
  const file = path.join(root, 'missing-review.json');
  writeFileSync(
    file,
    JSON.stringify({
      ...fixture,
      mode: 'isolated-behavior',
      isolatedBehavior: [
        {
          ...selection,
          manifest: path.join(pair.project, 'staged-inputs.json'),
          reviewId: '00000000-0000-4000-a000-000000000000',
        },
      ],
    }),
  );
  expect(() => new CodexWorkflowRuntimeActor(file, identityFile, selection)).toThrow(
    'staging review missing',
  );
});

it('refreshes from frozen B, resumes the same transport thread and preserves the genuine original profile', async () => {
  const { pair, fixture, original } = ready();
  const actor = await consumer();
  actor.run('Initial action without tools.');
  const frozen = pair.stages.map(stage => bundleInventory(stage.packageRoot));
  await actor.refresh();
  actor.run('Resume without tools.', true);
  await actor.preserve();
  const index = JSON.parse(
    readFileSync(path.join(actor.artifacts, 'refreshed-installation.json'), 'utf8'),
  );
  expect(bundleInventory(index.installed)).toEqual(frozen[1]);
  expect(pair.stages.map(stage => bundleInventory(stage.packageRoot))).toEqual(frozen);
  expect(bundleInventory(fixture.profile as string)).toEqual(original);
  const result = JSON.parse(readFileSync(path.join(actor.artifacts, 'preservation.json'), 'utf8'));
  expect(result).toMatchObject({
    fiveTrustedBindingsUnchanged: false,
    persistedHookTrustBypassed: true,
    originalFiveTrustedBindingsUnchanged: true,
    fiveEnabledBindingsUnchanged: true,
    mode: 'isolated-behavior',
    admissionEligible: false,
  });
  expect(result.nativeBehaviorArgv).toHaveLength(2);
  expect(readFileSync(path.join(actor.artifacts, 'profile/config.toml'), 'utf8')).not.toContain(
    'DO_NOT_TRANSFER',
  );
  expect(existsSync(path.join(actor.artifacts, 'revision-1.json'))).toBe(false);
});
