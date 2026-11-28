import assert from 'node:assert/strict';
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

import { afterAll, expect, it } from 'vitest';

import {
  codexWorkflowTemporaryBase,
  type HookObservation,
} from '../helpers/codex-internal-workflows.js';
import { CodexWorkflowRuntimeActor } from '../helpers/codex-workflow-runtime.js';

const prefix = path.join(codexWorkflowTemporaryBase(), 'codex-guard-hashes-');
const root = realpathSync(mkdtempSync(prefix));
const profile = path.join(root, 'profile');
const project = path.join(root, 'project');
const installedPath = path.join(profile, 'plugins/cache/original');
mkdirSync(project);
cpSync(path.resolve(import.meta.dirname, '../../codex-plugin'), installedPath, { recursive: true });
const config = path.join(profile, 'config.toml');
writeFileSync(config, 'check_for_update_on_startup=false\n');
const hash = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
const manifest = hash(path.join(installedPath, 'hooks.json'));
const runtimeSha256 = hash(path.join(installedPath, 'runtime/cli.js'));
const packageManifestSha256 = hash(path.join(installedPath, '.codex-plugin/plugin.json'));
const identityFile = path.join(root, 'identity.json');
writeFileSync(
  identityFile,
  JSON.stringify({
    originalManifest: manifest,
    runtimeSha256,
  }),
);
const inventory = path.join(root, 'inventory.json');
const binary = path.join(root, 'vendor');
// Only the external inventory process is substituted; real actor comparison,
// child preservation and original profile/package preservation execute.
writeFileSync(
  binary,
  `#!${process.execPath}
const fs=require('node:fs'),rl=require('node:readline').createInterface({input:process.stdin});
rl.on('line',line=>{const q=JSON.parse(line);if(q.id===1)console.log(JSON.stringify({id:1,result:{}}));if(q.id===2)console.log(JSON.stringify({id:2,result:{data:[{errors:[],warnings:[],hooks:JSON.parse(fs.readFileSync(${JSON.stringify(inventory)},'utf8'))}]}}));});
`,
  { mode: 0o755 },
);
const events = ['postToolUse', 'preToolUse', 'sessionStart', 'stop', 'userPromptSubmit'];
const stage = (revision: string) =>
  events.map((eventName, displayOrder) => ({
    eventName,
    displayOrder,
    sourcePath: '/owned/child/hooks.json',
    enabled: true,
    trustStatus: 'trusted',
    command: `hook ${eventName}`,
    currentHash: `sha256:${eventName}/sha256:${revision}`,
  }));
const A = stage('A');
const B = stage('B');
class BoundaryActor extends CodexWorkflowRuntimeActor {
  constructor(qualifier = true) {
    const file = path.join(root, `fixture-${qualifier}.json`);
    writeFileSync(
      file,
      JSON.stringify({
        root,
        profile,
        project,
        installedPath,
        binary,
        hookManifestSha256: manifest,
        packageManifestSha256,
        normalTrustQualification: qualifier,
      }),
    );
    super(file, identityFile, {
      caseId: 'a-restarted-session-receives-current-essential-workflow-instructions',
      arm: 'single',
    });
    this.before = structuredClone(A);
  }
  refreshed(hooks: HookObservation[]) {
    this.acceptRefreshedBindings(hooks);
  }
  originalObservation() {
    return this.before;
  }
}
afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

it('accepts changed fingerprints on all five stable trusted bindings and preserves exact B', async () => {
  const actor = new BoundaryActor();
  actor.refreshed(B);
  expect(actor.originalObservation()).toEqual(A);
  writeFileSync(inventory, JSON.stringify(B));
  await actor.preserve();
  const result = readFileSync(path.join(actor.artifacts, 'preservation.json'), 'utf8');
  expect(JSON.parse(result)).toMatchObject({
    fiveTrustedBindingsUnchanged: true,
    normalTrustQualification: { mode: 'normal-trust-invalidation' },
  });
});

it.each(['eventName', 'sourcePath', 'enabled', 'trustStatus', 'command', 'displayOrder'] as const)(
  'rejects changed stable %s',
  key => {
    const actor = new BoundaryActor();
    const changed = structuredClone(B);
    assert.ok(changed[0]);
    Object.assign(changed[0], { [key]: key === 'enabled' ? false : 'foreign' });
    expect(() => {
      actor.refreshed(changed);
    }).toThrow('normal trust bindings changed');
  },
);

it.each(['unchanged', 'empty', 'absent'] as const)(
  'rejects %s fingerprint on one corresponding hook',
  fault => {
    const actor = new BoundaryActor();
    const changed = structuredClone(B);
    assert.ok(changed[2] && A[2]);
    const currentHash = { unchanged: A[2].currentHash, empty: '', absent: undefined }[fault];
    Object.assign(changed[2], { currentHash });
    expect(() => {
      actor.refreshed(changed);
    }).toThrow(/normal trust (fingerprint missing|fingerprint unchanged)/u);
  },
);

it('rejects missing binding', () => {
  expect(() => {
    new BoundaryActor().refreshed(B.slice(1));
  }).toThrow('normal trust bindings changed');
});

it('refuses any B inventory drift after the resumed-turn boundary', async () => {
  const actor = new BoundaryActor();
  actor.refreshed(B);
  writeFileSync(inventory, JSON.stringify(stage('C')));
  await expect(actor.preserve()).rejects.toThrow('deep-equal');
});

it('still independently refuses changed original profile configuration', async () => {
  const actor = new BoundaryActor();
  actor.refreshed(B);
  writeFileSync(inventory, JSON.stringify(B));
  const original = readFileSync(config, 'utf8');
  try {
    writeFileSync(config, `${original}changed=true\n`);
    await expect(actor.preserve()).rejects.toThrow('strictly equal');
  } finally {
    writeFileSync(config, original);
  }
});

it('keeps default normal equality strict', () => {
  const actor = new BoundaryActor(false);
  actor.refreshed(A);
  expect(() => {
    actor.refreshed(B);
  }).toThrow('deep-equal');
});
