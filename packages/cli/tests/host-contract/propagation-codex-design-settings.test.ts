import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
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

import { expect, it } from 'vitest';

import { runDesignApprovalSettings } from '../../scripts/lib/propagation-settings.js';
import type {
  DesignSettingObservation,
  RetainedPolicyActor,
} from '../../scripts/lib/resource-propagation.js';
import {
  captureNativePropagationActor,
  retainNativeResourceActor,
} from '../../scripts/lib/resource-propagation-run.js';
import releases from '../../src/lifecycle/host-releases.json' with { type: 'json' };
import combinations from '../fixtures/host-contract/documented-option-composition.json';
import { CodexNativeCatalogueActor } from '../helpers/codex-native-catalogue.js';
import { createCanonicalCatalogueInputs } from '../helpers/native-catalogue-probe.js';
import { preparePropagationDesignApproval } from '../helpers/propagation-policy-case.js';
import {
  createPropagationSource,
  generatePropagationPackage,
} from '../helpers/propagation-source.js';

// Shared-owner characterization only: actual generated registered Codex callback,
// ordinary Given and genuine apply_patch delta. No native/model/trust proof.
it('characterizes the current packaged Codex apply_patch design transition', async () => {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'codex-design-owner-'));
  try {
    const project = nodePath.join(root, 'project');
    mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
    writeFileSync(nodePath.join(project, '.safeword/SAFEWORD.md'), 'Synthetic enrolled project.\n');
    writeFileSync(nodePath.join(project, '.safeword/config.json'), '{}');
    const git = spawnSync('git', ['init', '--quiet'], { cwd: project, encoding: 'utf8' });
    assert.equal(git.status, 0, git.stderr);
    const inputs = createCanonicalCatalogueInputs(root);
    const plugin = nodePath.join(root, 'package');
    await generatePropagationPackage(
      { ...inputs, sourcePackage: createPropagationSource(root, inputs) },
      plugin,
      'codex',
    );
    const hooks = JSON.parse(readFileSync(nodePath.join(plugin, 'hooks.json'), 'utf8'));
    const binding = hooks.hooks.PreToolUse[0].hooks[0].command;
    for (const enabled of [false, true, false]) {
      const prepared = preparePropagationDesignApproval(project, enabled);
      const patch = [
        '*** Begin Patch',
        `*** Update File: ${prepared.file}`,
        '@@',
        '-phase: plan-implementation',
        '+phase: plan-execution',
        '*** End Patch',
      ].join('\n');
      const actual = spawnSync('sh', ['-c', binding], {
        cwd: project,
        env: {
          ...process.env,
          CODEX_HOME: nodePath.join(root, 'profile'),
          PLUGIN_ROOT: plugin,
          SAFEWORD_CLI: undefined,
          CLAUDE_PROJECT_DIR: undefined,
          SAFEWORD_PLUGIN_CLI: undefined,
        },
        encoding: 'utf8',
        input: JSON.stringify({
          cwd: project,
          session_id: 'source-design',
          tool_name: 'apply_patch',
          tool_input: { command: patch },
        }),
      });
      expect(actual.status, actual.stderr).toBe(0);
      const decision = actual.stdout.trim() ? JSON.parse(actual.stdout) : {};
      if (enabled)
        expect(decision.hookSpecificOutput).toMatchObject({
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: expect.stringMatching(/design approval.*approve-plan/isu),
        });
      else expect(decision.hookSpecificOutput?.permissionDecision).toBeUndefined();
      expect(readFileSync(prepared.file, 'utf8')).toBe(prepared.before);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 120_000);

// Real factory, generated owner and capture. Only external Codex process substituted.
it('captures six retained Codex apply_patch design settings', async () => {
  const temporary = mkdtempSync(nodePath.join(tmpdir(), 'codex-guard-'));
  const root = realpathSync(temporary);
  try {
    const inputs = createCanonicalCatalogueInputs(root);
    const canonical = { ...inputs, sourcePackage: createPropagationSource(root, inputs) };
    const profile = nodePath.join(root, 'profile'),
      project = nodePath.join(root, 'project');
    const installedPath = nodePath.join(profile, 'plugins/cache/candidate');
    mkdirSync(project);
    mkdirSync(profile);
    assert.equal(spawnSync('git', ['init', '--quiet'], { cwd: project }).status, 0);
    await generatePropagationPackage(canonical, installedPath, 'codex');
    const binary = nodePath.join(root, 'vendor');
    writeFileSync(
      binary,
      `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(nodePath.join(root, 'vendor.mjs'))} "$@"\n`,
      { mode: 0o755 },
    );
    writeFileSync(
      nodePath.join(root, 'vendor.mjs'),
      String.raw`
import {cpSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root=path.dirname(process.env.CODEX_HOME), plugin=path.join(process.env.CODEX_HOME,'plugins/cache/candidate');
if(process.argv.includes('--version')) {console.log(${JSON.stringify(`codex-cli ${releases.codex.version}`)}); process.exit(0);}
if(process.argv.includes('marketplace')) {console.log('{}'); process.exit(0);}
if(process.argv.includes('plugin')&&process.argv.includes('add')) {
 const registry=JSON.parse(readFileSync(path.join(root,'.agents/plugins/marketplace.json'),'utf8'));
 cpSync(path.resolve(root,registry.plugins[0].source.path),plugin,{recursive:true});
 console.log(JSON.stringify({installedPath:plugin})); process.exit(0);
}
if(process.argv.includes('app-server')) {
 const {createInterface}=await import('node:readline');
 for await(const line of createInterface({input:process.stdin})) {
 const m=JSON.parse(line); if(m.id===1)console.log(JSON.stringify({id:1,result:{}}));
 if(m.id===2)console.log(JSON.stringify({id:2,result:{data:[{errors:[],warnings:[],hooks:['sessionStart','userPromptSubmit','preToolUse','postToolUse','stop'].map(eventName=>({eventName,sourcePath:path.join(plugin,'hooks.json'),enabled:true,trustStatus:'trusted'}))}]}}));
 } process.exit(0);
}
const patch=JSON.parse(process.argv.at(-1).split('CODEX_DESIGN_PATCH=')[1]);
const session='source-design-session';
console.log(JSON.stringify({type:'thread.started',thread_id:session}));
if(!existsSync(path.join(root,'missing-callback'))) {
 const binding=JSON.parse(readFileSync(path.join(plugin,'hooks.json'),'utf8')).hooks.PreToolUse[0].hooks[0].command;
 const r=spawnSync('sh',['-c',binding],{env:{...process.env,PLUGIN_ROOT:plugin},encoding:'utf8',input:JSON.stringify({cwd:process.cwd(),session_id:existsSync(path.join(root,'foreign-session'))?'foreign':session,tool_name:'apply_patch',tool_input:{command:patch}})});
 if(r.status!==0) throw Error(r.stderr);
 const d=r.stdout.trim()?JSON.parse(r.stdout):{};
 if(d.hookSpecificOutput?.permissionDecision!=='deny') {
  const file=patch.split('\n')[1].slice('*** Update File: '.length);
  writeFileSync(file,readFileSync(file,'utf8').replace('phase: plan-implementation','phase: plan-execution'));
 }
}
if(!existsSync(path.join(root,'incomplete')))console.log(JSON.stringify({type:'turn.completed'}));
`,
    );
    const actor = new CodexNativeCatalogueActor(
      { root, binary, profile, project, installedPath },
      canonical,
      'provisioned',
    );
    await actor.prepare('Codex', releases.codex.version, 'CLI');
    const retained = retainNativeResourceActor(actor);
    const captured = captureNativePropagationActor(retained, 'codex-design', root);
    const result = await runDesignApprovalSettings(captured);
    expect(result.exit, result.failures.join('\n')).toBe(0);
    expect(result.observations).toHaveLength(6);
    for (const [i, row] of result.observations.entries()) {
      expect(row.protocol).toBe('codex-pre-tool-json');
      assert.ok(row.protocol === 'codex-pre-tool-json');
      expect(JSON.parse(row.observation.configuration.bytes)).toMatchObject(combinations[i] ?? {});
      expect(row.observation.configuration.after).toBe(row.observation.configuration.bytes);
      expect(row.observation.installation).toBe(result.observations[0]?.observation.installation);
      expect(row.observation.raw).toContain('apply_patch');
      expect(row.observation.effect).toBe(
        combinations[i]?.designApprovalGate
          ? row.observation.before
          : row.observation.expectedEffect,
      );
    }
    await capturedFaults(result.observations, retained, root);
    await sourceFaults(captured, root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 120_000);

// Captured grader-only fault projections; never fabricated native decisions.
async function capturedFaults(
  rows: DesignSettingObservation[],
  retained: RetainedPolicyActor,
  root: string,
) {
  type Facts = Extract<
    DesignSettingObservation,
    { protocol: 'codex-pre-tool-json' }
  >['observation'];
  const cases: { name: string; index: number; exit: number; alter: (o: Facts) => Facts }[] = [
    {
      name: 'after',
      index: 1,
      exit: 2,
      alter: o => ({
        ...o,
        configuration: { ...o.configuration, after: `${o.configuration.bytes}\n` },
      }),
    },
    {
      name: 'missing-after',
      index: 1,
      exit: 3,
      alter: o => ({
        ...o,
        configuration: { ...o.configuration, after: undefined as unknown as string },
      }),
    },
    {
      name: 'dropped',
      index: 1,
      exit: 2,
      alter: o => ({
        ...o,
        configuration: {
          ...o.configuration,
          bytes: JSON.stringify({
            ...JSON.parse(o.configuration.bytes),
            designApprovalGate: false,
          }),
          after: JSON.stringify({
            ...JSON.parse(o.configuration.bytes),
            designApprovalGate: false,
          }),
        },
      }),
    },
    {
      name: 'enabled-allow',
      index: 1,
      exit: 2,
      alter: o => ({
        ...o,
        decision: {
          hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow' },
        },
      }),
    },
    {
      name: 'event',
      index: 1,
      exit: 2,
      alter: o => ({
        ...o,
        decision: {
          hookSpecificOutput: { ...o.decision.hookSpecificOutput, hookEventName: 'Stop' },
        },
      }),
    },
    {
      name: 'reason',
      index: 1,
      exit: 2,
      alter: o => ({
        ...o,
        decision: {
          hookSpecificOutput: {
            ...o.decision.hookSpecificOutput,
            permissionDecisionReason: 'unrelated',
          },
        },
      }),
    },
    {
      name: 'off-deny',
      index: 0,
      exit: 2,
      alter: o => ({ ...o, decision: { hookSpecificOutput: { permissionDecision: 'deny' } } }),
    },
    { name: 'denied-effect', index: 1, exit: 2, alter: o => ({ ...o, effect: o.expectedEffect }) },
    { name: 'allowed-missing', index: 0, exit: 2, alter: o => ({ ...o, effect: o.before }) },
    { name: 'identity', index: 0, exit: 3, alter: o => ({ ...o, installation: '' }) },
    { name: 'raw', index: 0, exit: 3, alter: o => ({ ...o, raw: '' }) },
    {
      name: 'config-path',
      index: 0,
      exit: 3,
      alter: o => ({ ...o, configuration: { ...o.configuration, path: '' } }),
    },
  ];
  const oracle = JSON.stringify(combinations),
    originals = JSON.stringify(rows);
  for (const { name, index, exit, alter } of cases) {
    const actual = rows[index];
    assert.ok(actual?.protocol === 'codex-pre-tool-json');
    const changed = alter(structuredClone(actual.observation));
    const altered = { ...actual, observation: changed };
    let current = 0;
    const captured = captureNativePropagationActor(
      {
        ...retained,
        observeDesignApproval: () => {
          const source = rows[current];
          assert.ok(source);
          return Promise.resolve(current++ === index ? altered : source);
        },
      },
      name,
      root,
    );
    const grade = await runDesignApprovalSettings(captured);
    expect(grade.exit).toBe(exit);
    expect(grade.failures).toEqual([
      `PROPAGATION_DESIGN_SETTING:${index}:${exit === 3 ? 'UNOBSERVED' : 'MISMATCH'}`,
    ]);
    expect(grade.observations[index]).toBe(altered);
    const entry = readFileSync(nodePath.join(root, 'observations.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map(k => JSON.parse(k) as { lane: string; observation_artifact: string })
      .filter(k => k.lane === name)[index];
    assert.ok(entry);
    expect(readFileSync(entry.observation_artifact, 'utf8').trim()).toBe(JSON.stringify(changed));
    expect(JSON.stringify(combinations)).toBe(oracle);
    expect(JSON.stringify(rows)).toBe(originals);
  }
}

async function sourceFaults(captured: RetainedPolicyActor, root: string) {
  const faults = {
    'missing-callback': 'callback cardinality',
    'foreign-session': 'foreign',
    incomplete: 'turn incomplete',
  };
  for (const [fault, reason] of Object.entries(faults)) {
    const prior = new Set(readdirSync(root));
    writeFileSync(nodePath.join(root, fault), '');
    const options = combinations[0];
    assert.ok(options);
    await expect(captured.observeDesignApproval?.(options)).rejects.toThrow(reason);
    rmSync(nodePath.join(root, fault));
    // The actual failed vendor output is retained even before outer capture can return facts.
    const directories = readdirSync(root).filter(
      k => k.startsWith('design-write-') && !prior.has(k),
    );
    expect(directories).toHaveLength(1);
    const directory = directories[0];
    assert.ok(directory);
    const failed = JSON.parse(
      readFileSync(nodePath.join(root, directory, 'observation.json'), 'utf8'),
    );
    expect(failed.stdout).toContain('source-design-session');
    expect(failed.callbacks).toHaveLength(fault === 'missing-callback' ? 0 : 1);
  }
}
