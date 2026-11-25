import assert from 'node:assert/strict';
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
import capturedFrame from '../fixtures/host-contract/codex-0.167-folder-frame.json';
import { codexInternalCases } from '../fixtures/host-contract/native-contract-cases.js';
import {
  bundleInventory,
  CodexInternalWorkflowActor,
  codexWorkflowTemporaryBase,
} from '../helpers/codex-internal-workflows.js';
import { workflowReviewGroups } from '../helpers/codex-reviewed-workflow.js';
import { CodexWorkflowRuntimeActor } from '../helpers/codex-workflow-runtime.js';

const originalStateHome = process.env.XDG_STATE_HOME;
const repo = path.resolve(import.meta.dirname, '../../../..');
const temporaryPrefix = path.join(codexWorkflowTemporaryBase(), 'codex-guard-picker-');
const root = realpathSync(mkdtempSync(temporaryPrefix));
const digest = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
const fault = path.join(root, 'fault');
const fixtureFile = path.join(root, 'fixture.json');
const identityFile = path.join(root, 'identity.json');
const selection = {
  caseId: codexInternalCases().find(row => row.id.includes('internal-selector'))?.id ?? '',
  arm: 'single',
};
const state: { fixture?: Record<string, unknown> } = {};
function ready() {
  assert.ok(state.fixture);
  return { fixture: state.fixture };
}

function withToolchain<T>(action: () => T): T {
  vi.stubEnv('XDG_STATE_HOME', originalStateHome);
  try {
    return action();
  } finally {
    vi.stubEnv('XDG_STATE_HOME', path.join(root, 'test-keys'));
  }
}

async function reviewPair(pair: ReturnType<CodexWorkflowRuntimeActor['stageRevisions']>) {
  vi.stubEnv('SAFEWORD_PLUGIN_CLI', pair.coordinator);
  const [code, raw] = workflowReviewGroups(pair);
  const codeJob = await startReviewJob({ cwd: pair.project, kind: 'quality-review', ...code });
  const rawJob = await startReviewJob({ cwd: pair.project, kind: 'quality-review', ...raw });
  expect(codeJob.data).toMatchObject({ status: 'approved' });
  expect(rawJob.data).toMatchObject({ status: 'approved' });
  return {
    reviewId: (codeJob.data as { review_id: string }).review_id,
    rawDeltaReviewId: (rawJob.data as { review_id: string }).review_id,
  };
}

function writeReviewedFixture(
  file: string,
  fixture: Record<string, unknown>,
  owner: { caseId: string; arm: string },
  pair: ReturnType<CodexWorkflowRuntimeActor['stageRevisions']>,
  reviews: Awaited<ReturnType<typeof reviewPair>>,
) {
  writeFileSync(
    file,
    JSON.stringify({
      ...fixture,
      mode: 'isolated-behavior',
      isolatedBehavior: [
        { ...owner, manifest: path.join(pair.project, 'staged-inputs.json'), ...reviews },
      ],
    }),
  );
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
if(args.includes('app-server')){const rl=require('node:readline').createInterface({input:process.stdin});rl.on('line',line=>{const q=JSON.parse(line);if(q.id===1)console.log(JSON.stringify({id:1,result:{}}));if(q.id===2)console.log(JSON.stringify({id:2,result:{data:[{errors:[],warnings:[],hooks:['postToolUse','preToolUse','sessionStart','stop','userPromptSubmit'].filter(n=>fault!=='missing-event'||n!=='stop').map(eventName=>({eventName,enabled:fault!=='disabled',trustStatus:profile===${JSON.stringify(profile)}||fault==='normal-trusted'?'trusted':'untrusted',sourcePath:fault==='foreign-event'?${JSON.stringify(path.join(installedPath, 'hooks.json'))}:p.join(installed,'hooks.json')}))}]}}));});}
else if(args.includes('exec')){fs.appendFileSync(p.join(base,'actual-argv.jsonl'),JSON.stringify(args)+'\n');if(!args.includes('--dangerously-bypass-hook-trust')){console.error('ISOLATED_BEHAVIOR_FLAG_MISSING');process.exit(2);}const id='11111111-1111-4111-a111-111111111111',sessions=p.join(profile,'sessions');fs.mkdirSync(sessions,{recursive:true});fs.appendFileSync(p.join(sessions,'rollout-'+id+'.jsonl'),JSON.stringify({type:'turn_context',payload:{model:'gpt-5.6-terra'}})+'\n');console.log(JSON.stringify({type:'thread.started',thread_id:id}));console.log(JSON.stringify({type:'turn.completed'}));}
else {fs.writeFileSync(p.join(base,'picker-observed-argv.json'),JSON.stringify([process.argv[1],...args]));process.stdin.setRawMode(true);process.stdin.resume();let text='',granted=false,drawn=0;const frame=t=>process.stdout.write('\x1b[?2026h'+t+'\x1b[?2026l');const ready=()=>frame('› Ask Codex to do anything');const prompt=fault==='other-dialog'?'Allow hooks?':Buffer.from(${JSON.stringify(capturedFrame.frameBase64)},'base64').toString().replace('__OWNED_PROJECT__',fault==='wrong-folder'?'/foreign/project':process.cwd());const emitPrompt=()=>{drawn=Date.now();return fault==='other-dialog'?frame(prompt):process.stdout.write(prompt);};if(fault==='late-folder')ready();else emitPrompt();if(fault==='changed-pending')setTimeout(()=>frame('Allow hooks?'),30);process.stdin.on('data',data=>{fs.appendFileSync(p.join(base,'picker-keys'),data);if(!granted&&data.includes(13)){if(fault==='drain'&&Date.now()-drawn<80){process.exit(0);return;}granted=true;if(fault==='repeat')emitPrompt();else if(fault==='unconfirmed')process.exit(0);else ready();return;}if(data.includes(21)){text='';ready();return;}text+=data.toString();if(fault==='late-folder'&&text==='$safeword:bdd'){emitPrompt();return;}for(const name of ['bdd','explain','testing'])if(text==='$safeword:'+name)frame((name==='testing'?'no matches':name+' (safeword) [Skill]')+' enter insert · esc close › '+text);});}
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
  const reviews = await reviewPair(pair);
  writeReviewedFixture(fixtureFile, fixture, selection, pair, reviews);
  assert.ok(pair && fixture && reviews.reviewId && bundleInventory(profile));
  state.fixture = fixture;
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

function json(file: string) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function expectPickerRefusal(actor: CodexInternalWorkflowActor, reason: string) {
  expect(() => {
    actor.inspectPicker();
  }).toThrow('picker exit 1');
  expect(readFileSync(path.join(actor.artifacts, 'picker.stderr'), 'utf8')).toContain(reason);
}

it('accepts only the owned selected native folder prompt without submitting a task', async () => {
  const actor = await consumer();
  try {
    actor.inspectPicker();
  } catch (error) {
    expect(readFileSync(path.join(actor.artifacts, 'picker.stderr'), 'utf8')).toContain(
      'HOST_CONTRACT_PROOF_UNAVAILABLE: unrelated native dialog',
    );
    throw error;
  }
  actor.assertPicker();
  const keys = readFileSync(path.join(actor.artifacts, 'picker-keys'), 'utf8');
  expect(keys.match(/\r/g)).toHaveLength(1);
  expect(keys).toBe('\r$safeword:bdd\u{15}$safeword:explain\u{15}$safeword:testing');
  expect(json(path.join(actor.artifacts, 'workspace-trust-action.json'))).toMatchObject({
    project: path.join(actor.artifacts, 'project'),
    confirmed: true,
    beforeConfigSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    afterConfigSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
  });
});

it.each(['wrong-folder', 'other-dialog'])(
  'refuses the %s prompt before sending any application key',
  async faultName => {
    writeFileSync(fault, faultName);
    const actor = await consumer();
    expectPickerRefusal(actor, 'unrelated native dialog');
    expect(() => readFileSync(path.join(actor.artifacts, 'picker-keys'))).toThrow();
  },
);

it('refuses a folder prompt after a picker query without sending Enter', async () => {
  writeFileSync(fault, 'late-folder');
  const actor = await consumer();
  expectPickerRefusal(actor, 'folder prompt after picker query');
  expect(readFileSync(path.join(actor.artifacts, 'picker-keys'), 'utf8')).toBe('$safeword:bdd');
});

it('waits for the native input boundary before the single folder approval', async () => {
  writeFileSync(fault, 'drain');
  const actor = await consumer();
  try {
    actor.inspectPicker();
  } catch (error) {
    const stderr = readFileSync(path.join(actor.artifacts, 'picker.stderr'), 'utf8');
    throw new Error(stderr, { cause: error });
  }
  actor.assertPicker();
  expect(readFileSync(path.join(actor.artifacts, 'picker-keys'), 'utf8').match(/\r/g)).toHaveLength(
    1,
  );
});

it('refuses a changed prompt before sending folder approval', async () => {
  writeFileSync(fault, 'changed-pending');
  const actor = await consumer();
  expectPickerRefusal(actor, 'unrelated native dialog');
  expect(() => readFileSync(path.join(actor.artifacts, 'picker-keys'))).toThrow();
});

it.each(['repeat', 'unconfirmed'])(
  'refuses %s folder approval without completing the picker',
  async faultName => {
    writeFileSync(fault, faultName);
    const actor = await consumer();
    expectPickerRefusal(
      actor,
      faultName === 'repeat' ? 'repeated folder prompt' : 'folder approval not confirmed',
    );
    expect(
      readFileSync(path.join(actor.artifacts, 'picker-keys'), 'utf8').match(/\r/g),
    ).toHaveLength(1);
    expect(json(path.join(actor.artifacts, 'workspace-trust-action.json'))).toMatchObject({
      confirmed: false,
    });
    expect(() => json(path.join(actor.artifacts, 'picker-observations.json'))).toThrow();
  },
);

it('normal mode refuses the native folder prompt without sending an application key', async () => {
  const { fixture } = ready();
  const normal = path.join(root, 'normal-folder.json');
  writeFileSync(normal, JSON.stringify(fixture));
  writeFileSync(fault, 'normal-trusted');
  const actor = new CodexInternalWorkflowActor(normal, identityFile);
  vi.stubEnv('XDG_STATE_HOME', originalStateHome);
  try {
    await actor.prepare();
  } finally {
    vi.stubEnv('XDG_STATE_HOME', path.join(root, 'test-keys'));
  }
  expectPickerRefusal(actor, 'unrelated native dialog');
  expect(() => readFileSync(path.join(actor.artifacts, 'picker-keys'))).toThrow();
});

async function resourceConsumer(caseId: string) {
  const { fixture } = ready();
  const isolatedSelection = { caseId, arm: 'single' };
  const normalFixture = path.join(root, `${caseId}-normal.json`);
  writeFileSync(normalFixture, JSON.stringify(fixture));
  const stager = new CodexWorkflowRuntimeActor(normalFixture, identityFile);
  const pair = withToolchain(() => stager.stageRevisions(isolatedSelection));
  const reviews = await reviewPair(pair);
  const reviewedFixture = path.join(root, `${caseId}-reviewed.json`);
  writeReviewedFixture(reviewedFixture, fixture, isolatedSelection, pair, reviews);
  const actor = new CodexWorkflowRuntimeActor(reviewedFixture, identityFile, isolatedSelection);
  await actor.prepareCanonical();
  return actor;
}

function expectResourcePreservation(
  actor: CodexWorkflowRuntimeActor,
  caseId: string,
  kind: string,
) {
  expect(json(path.join(actor.artifacts, 'preservation.json'))).toMatchObject({
    persistedHookTrustBypassed: false,
    nativeModelInvocation: 'not-applicable',
    resourceCheckCompleted: true,
    resourceCaseId: caseId,
    resourceCheckKind: kind,
    nativeBehaviorArgv: [],
    fiveEnabledBindingsUnchanged: true,
    originalFiveTrustedBindingsUnchanged: true,
  });
}

it.each([
  ['internal-references-resolve-their-complete-installed-resource-closure', 'closure'],
  ['missing-internal-resources-prevent-a-clean-generated-delivery-check', 'missing'],
])(
  'preserves completed %s without inventing a model invocation',
  async (caseId, kind) => {
    const actor = await resourceConsumer(caseId);
    withToolchain(() => {
      if (kind === 'closure') actor.traverseClosure();
      else {
        actor.prepareMissing();
        actor.checkMissing();
      }
    });
    if (kind === 'closure') actor.assertClosure();
    else actor.assertMissing();
    await actor.preserve();
    expectResourcePreservation(actor, caseId, kind);
  },
  180_000,
);

it.each(['missing', 'fabricated'])(
  'refuses a %s checker without an actual checker action',
  async kind => {
    const actor = await resourceConsumer(
      'missing-internal-resources-prevent-a-clean-generated-delivery-check',
    );
    if (kind === 'fabricated')
      writeFileSync(
        path.join(actor.artifacts, 'missing-check.json'),
        JSON.stringify({ status: 1, output: 'internal/testing/SKILL.md' }),
      );
    await expect(actor.preserve()).rejects.toThrow('isolated behavior argv missing');
  },
  180_000,
);

it('refuses a non-resource case with no actual native invocation', async () => {
  const actor = await consumer();
  await expect(actor.preserve()).rejects.toThrow('isolated behavior argv missing');
});

it('refuses closure completion for the missing-resource case', async () => {
  const actor = await resourceConsumer(
    'missing-internal-resources-prevent-a-clean-generated-delivery-check',
  );
  withToolchain(() => {
    actor.traverseClosure();
  });
  await expect(actor.preserve()).rejects.toThrow('isolated behavior argv missing');
}, 180_000);

it('refuses missing-resource completion for a non-resource case', async () => {
  const actor = await consumer();
  withToolchain(() => {
    actor.prepareMissing();
    actor.checkMissing();
  });
  await expect(actor.preserve()).rejects.toThrow('isolated behavior argv missing');
}, 180_000);
