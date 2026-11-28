import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { expect, it, vi } from 'vitest';

import {
  runArchitectureSettings,
  runHandoffSettings,
} from '../../scripts/lib/propagation-settings.js';
import {
  captureNativePropagationActor,
  retainNativeResourceActor,
} from '../../scripts/lib/resource-propagation-run.js';
import combinations from '../fixtures/host-contract/documented-option-composition.json';
import architectureCase from '../fixtures/host-contract/propagation-architecture-case.json';
import { CodexNativeCatalogueActor } from '../helpers/codex-native-catalogue.js';
import type { StopObservation } from '../helpers/codex-native-continuation.js';
import { createCanonicalCatalogueInputs } from '../helpers/native-catalogue-probe.js';
import {
  createPropagationSource,
  generatePropagationPackage,
  requirePropagationVerificationMarker,
} from '../helpers/propagation-source.js';

// Only external Codex process substituted. Actual generated Stop binding,
// frozen observer, runtime, ordinary state and local tests; NOT native evidence.
it.each(['fresh', 'provisioned'] as const)(
  'reuses %s native Codex binding without borrowing parent trust',
  async binding => {
    const temporary = mkdtempSync(nodePath.join(tmpdir(), 'codex-guard-'));
    const root = realpathSync(temporary);
    try {
      const inputs = createCanonicalCatalogueInputs(root);
      const sourcePackage = createPropagationSource(root, inputs);
      const marker = 'VERIFICATION_aa-bb';
      requirePropagationVerificationMarker(inputs, marker);
      const profile = nodePath.join(root, 'profile');
      mkdirSync(profile);
      // Dummy external-service input, never a copied user credential.
      writeFileSync(nodePath.join(profile, 'auth.json'), '{"fixture_only":true}');
      const project = nodePath.join(root, 'project');
      const installedPath = nodePath.join(profile, 'plugins/cache/candidate');
      if (binding === 'provisioned') {
        mkdirSync(project);
        execFileSync('git', ['init', '--quiet'], { cwd: project });
        await generatePropagationPackage({ ...inputs, sourcePackage }, installedPath, 'codex');
      }
      const binary = nodePath.join(root, 'host');
      writeFileSync(
        binary,
        `#!/bin/sh\nexport HOME=${JSON.stringify(root)}\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(nodePath.join(root, 'host.mjs'))} "$@"\n`,
        { mode: 0o755 },
      );
      writeFileSync(
        nodePath.join(root, 'host.mjs'),
        String.raw`
import { appendFileSync, cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
if (process.argv.includes('--version')) { console.log('codex-cli 0.167.0'); process.exit(0); }
const plugin = path.join(process.env.CODEX_HOME, 'plugins/cache/candidate');
if (process.argv.includes('marketplace')) { console.log('{}'); process.exit(0); }
if (process.argv.includes('plugin') && process.argv.includes('add')) {
  const root = path.dirname(process.env.CODEX_HOME);
  const registry = JSON.parse(readFileSync(path.join(root, '.agents/plugins/marketplace.json'), 'utf8'));
  cpSync(path.resolve(root, registry.plugins[0].source.path), plugin, { recursive: true });
  writeFileSync(${JSON.stringify(nodePath.join(root, 'installed-location.json'))}, JSON.stringify({ installedPath: plugin }));
  console.log(JSON.stringify({ installedPath: plugin })); process.exit(0);
}
if (process.argv.includes('app-server')) {
  const { createInterface } = await import('node:readline');
  const lines = createInterface({ input: process.stdin });
  for await (const line of lines) {
    const message = JSON.parse(line);
    if (message.id === 1) console.log(JSON.stringify({ id: 1, result: {} }));
    if (message.id === 2) console.log(JSON.stringify({ id: 2, result: { data: [{ errors: [], warnings: [], hooks:
      ['sessionStart','userPromptSubmit','preToolUse','postToolUse','stop'].map(eventName => ({
        eventName, sourcePath: path.join(plugin, 'hooks.json'), enabled: true,
        trustStatus: existsSync(${JSON.stringify(nodePath.join(root, 'untrusted'))}) ? 'untrusted' : 'trusted'
      }))
    }] } }));
  }
  process.exit(0);
}
if (process.argv.includes('exec') && !process.argv.includes('--skip-git-repo-check')) {
  const git = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], { encoding: 'utf8' });
  if (git.status !== 0 || git.stdout.trim() !== 'true') throw new Error('OWNED_CODEX_PROJECT_NOT_GIT');
}
appendFileSync(${JSON.stringify(nodePath.join(root, 'model-calls'))}, 'exec\n');
const handoff=/^HANDOFF_HELPER_COMMAND=(.+)$/m.exec(process.argv.at(-1));
const transcript=path.join(process.cwd(),'.host-contract','source-vendor-rollout.jsonl');
const turn=String(readFileSync(${JSON.stringify(nodePath.join(root, 'model-calls'))},'utf8').split('\n').length);
const append=payload=>appendFileSync(transcript,JSON.stringify({type:'response_item',payload})+'\n');
const faultPath=${JSON.stringify(nodePath.join(root, 'terminal-fault'))};
const fault=existsSync(faultPath)?readFileSync(faultPath,'utf8'):'';
let messageIndex=0;
function message(text,phase){
 if(phase==='final_answer'&&fault==='missing')return;
 if(phase==='final_answer'&&fault==='text')text='Mismatched terminal response';
 append({type:'message',id:turn+'-'+(++messageIndex),role:'assistant',phase:fault==='phase'?undefined:phase,
  internal_chat_message_metadata_passthrough:{turn_id:fault==='turn'?'foreign-turn':turn},content:[{type:'output_text',text}]});
 if(!(phase==='final_answer'&&fault==='event'))console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text}}));
}
let helperEvent;
console.log(JSON.stringify({ type: 'thread.started', thread_id: 'source-thread' }));
// Qualified external vendor-process record; never produced by the native actor.
appendFileSync(transcript,JSON.stringify({type:'turn_context',payload:{turn_id:turn,root_turn_id:turn,cwd:process.cwd()}})+'\n');
if(handoff){
 message('I will run the supplied helper when requested.','commentary');
 const command=JSON.parse(handoff[1]);
 if(command&&!existsSync(${JSON.stringify(nodePath.join(root, 'skip-helper'))})){
  append({type:'custom_tool_call',call_id:turn,id:'ctc-'+turn,name:'exec',input:command,internal_chat_message_metadata_passthrough:{turn_id:turn}});
  const result=spawnSync('sh',['-c',command],{encoding:'utf8'});
  if(result.status!==0)throw Error(result.stderr);
  append({type:'custom_tool_call_output',call_id:turn,id:'ctco-'+turn,output:result.stdout,internal_chat_message_metadata_passthrough:{turn_id:turn}});
  helperEvent={type:'item.completed',item:{type:'command_execution',command,exit_code:result.status,aggregated_output:result.stdout}};
 }
 if(existsSync(${JSON.stringify(nodePath.join(root, 'wrong-reason'))}))writeFileSync(path.join(process.cwd(),'.project/tickets/PRP123-propagation/verify.md'),'invalid');
}
if(existsSync(${JSON.stringify(nodePath.join(root, 'architecture-wrong-evidence'))})){
 const plan=path.join(process.cwd(),'.project/tickets/PRP123-propagation/impl-plan.md');
 writeFileSync(plan,readFileSync(plan,'utf8').replace('Use the existing local store.','skip: controlled source countercase'));
}
function stop(active,last='READY'){
 if (existsSync(${JSON.stringify(nodePath.join(root, 'omit'))}))return {};
  const hooks = JSON.parse(readFileSync(plugin + '/hooks.json', 'utf8'));
  const result = spawnSync('sh', ['-c', hooks.hooks.Stop[0].hooks[0].command], {
    env: { ...process.env, PLUGIN_ROOT: plugin, SAFEWORD_CLI: undefined }, encoding: 'utf8',
    input: JSON.stringify({ cwd: process.cwd(), session_id: existsSync(${JSON.stringify(nodePath.join(root, 'foreign-session'))})?'foreign-session':'source-thread', stop_hook_active: active, hook_event_name:'Stop',turn_id:existsSync(${JSON.stringify(nodePath.join(root, 'missing-turn'))})?undefined:turn,transcript_path:transcript,last_assistant_message:last })
  });
  if (result.status !== 0) throw new Error(result.stderr);
  return JSON.parse(result.stdout);
}
if(helperEvent)console.log(JSON.stringify(helperEvent));
if(handoff)message('READY','final_answer');
else console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'READY'}}));
if(existsSync(${JSON.stringify(nodePath.join(root, 'change-config'))})){
 const config=path.join(process.cwd(),'.safeword/config.json');
 const value=JSON.parse(readFileSync(config,'utf8'));
 writeFileSync(config,JSON.stringify({...value,crossModelReview:!value.crossModelReview}));
}
const decision=stop(false);
if(handoff&&decision.decision==='block'&&fault!=='no-followup'){
 message('Observed host correction','final_answer');
 stop(true,'Observed host correction');
}
if(handoff&&fault==='extra')message('Unexpected extra terminal answer','final_answer');
if(handoff&&fault==='stop-extra')stop(true,'Observed host correction');
if(fault!=='completed')console.log(JSON.stringify({ type: 'turn.completed' }));
`,
      );
      const actor = new CodexNativeCatalogueActor(
        {
          root,
          binary,
          profile,
          project,
          installedPath:
            binding === 'provisioned' ? installedPath : nodePath.join(profile, 'unused'),
        },
        { ...inputs, sourcePackage },
        binding,
      );
      await actor.prepare('Codex', '0.167.0', 'CLI');
      const installed = JSON.parse(
        readFileSync(nodePath.join(root, 'installed-location.json'), 'utf8'),
      ).installedPath;
      expect(
        existsSync(nodePath.join(installed, 'plugin.json')),
        'CODEX_NATIVE_CONTAINER_SUPPRESSED',
      ).toBe(false);
      const prepared = actor.preparedFixture();
      expect(prepared.profile === realpathSync(profile)).toBe(binding === 'provisioned');
      expect(prepared.installedPath).toBe(realpathSync(installed));
      expect(readFileSync(nodePath.join(profile, 'auth.json'), 'utf8')).toBe(
        '{"fixture_only":true}',
      );
      if (binding === 'provisioned') {
        vi.stubEnv('CODEX_HOME', profile);
        try {
          expect(
            () =>
              new CodexNativeCatalogueActor(prepared, { ...inputs, sourcePackage }, 'provisioned'),
          ).toThrow('CODEX_AUTHOR_PROFILE_REFUSED');
        } finally {
          vi.unstubAllEnvs();
        }
      }
      const scope = '**PR Scope:** ✅ Synthetic fixture matches its scope\n';
      const denied = await actor.observeVerification(scope);
      expect(denied.decisions).toContainEqual(
        expect.objectContaining({
          decision: 'block',
          reason: expect.stringContaining(`PROPAGATION_VERIFICATION_MARKER_REQUIRED:${marker}`),
        }),
      );
      expect(denied.ticket).toMatch(/^status: in_progress$/mu);
      const allowed = await actor.observeVerification(`${scope}\n${marker}\n`);
      expect(allowed.installation).toBe(denied.installation);
      expect(allowed.decisions).toEqual([{}]);
      expect(allowed.ticket).toMatch(/^status: done$/mu);
      expect(JSON.parse(allowed.raw).observations[0].input.session_id).toBe('source-thread');
      const correction = await actor.observeVerification(`${scope}\n${marker}\n`, {
        enabled: true,
        currentTool: true,
      });
      expect(correction.decisions, 'CODEX_TERMINAL_HANDOFF_OPTION_DROPPED').toContainEqual(
        expect.objectContaining({
          decision: 'block',
          reason: expect.stringContaining('terminal-handoff/v1 correction'),
        }),
      );
      expect(correction.installation).toBe(allowed.installation);
      expect(correction.ticket).toMatch(/^status: done$/mu);
      const rawCorrection = JSON.parse(correction.raw) as {
        helper: { marker: string };
        observations: StopObservation[];
      };
      expect(rawCorrection.helper.marker).toBe(inputs.helperMarker);
      expect(rawCorrection.observations.map(row => row.input.stop_hook_active)).toEqual([
        false,
        true,
      ]);
      const disabledHandoff = await actor.observeVerification(`${scope}\n${marker}\n`, {
        enabled: false,
        currentTool: true,
      });
      expect(disabledHandoff.decisions).toEqual([{}]);
      expect(disabledHandoff.installation).toBe(correction.installation);
      expect(JSON.parse(disabledHandoff.raw).helper.marker).toBe(inputs.helperMarker);
      const noCurrentTool = await actor.observeVerification(`${scope}\n${marker}\n`, {
        enabled: true,
        currentTool: false,
      });
      expect(noCurrentTool.decisions).toEqual([{}]);
      expect(JSON.parse(noCurrentTool.raw).helper).toBeUndefined();
      const architectureOptions = combinations[2];
      assert.ok(architectureOptions);
      const architecture = await actor.observeVerification(`${scope}\n${marker}\n`, {
        ...architectureCase,
        options: { ...architectureOptions },
      });
      expect(architecture.ticket, 'CODEX_ARCHITECTURE_GIVEN_DROPPED').toMatch(/^type: feature$/mu);
      await characterizeArchitecture(actor, root, `${scope}\n${marker}\n`, allowed.installation);
      // Real factory/capture/shared runner; only the vendor process above is substituted.
      const captured = nodePath.join(root, 'handoff-capture');
      mkdirSync(captured);
      const settings = await runHandoffSettings(
        captureNativePropagationActor(retainNativeResourceActor(actor), 'codex', captured),
      );
      expect(settings.exit, 'CODEX_RETAINED_HANDOFF_UNWIRED').toBe(0);
      expect(settings.failures).toEqual([]);
      expect(settings.observations).toHaveLength(7);
      for (const [index, observed] of settings.observations.entries()) {
        const options = combinations[index] ?? combinations[1];
        assert.ok(options);
        expect(JSON.parse(observed.configuration.bytes)).toMatchObject(options);
        expect(observed.installation).toBe(allowed.installation);
        expect(Boolean(observed.helper)).toBe(index < 6);
        const raw = JSON.parse(observed.raw);
        expect(raw.configuration).toEqual(observed.configuration);
        expect(raw.observations[0].input.session_id).toBe('source-thread');
      }
      expect(
        readFileSync(nodePath.join(captured, 'observations.jsonl'), 'utf8').trim().split('\n'),
      ).toHaveLength(7);
      const configured = retainNativeResourceActor(actor);
      const configuredHandoff = configured.observeHandoff?.bind(configured);
      assert.ok(configuredHandoff);
      const enabledOptions = combinations[1];
      assert.ok(enabledOptions);
      writeFileSync(nodePath.join(root, 'change-config'), '');
      await expect(
        configuredHandoff({ options: enabledOptions, currentTool: true }),
      ).rejects.toThrow('settings changed during native turn');
      rmSync(nodePath.join(root, 'change-config'));
      writeFileSync(nodePath.join(root, 'skip-helper'), '');
      await expect(
        configuredHandoff({ options: enabledOptions, currentTool: true }),
      ).rejects.toThrow('NATIVE_HANDOFF_HELPER_MISSING');
      rmSync(nodePath.join(root, 'skip-helper'));
      writeFileSync(nodePath.join(root, 'terminal-fault'), 'no-followup');
      const bounded = captureNativePropagationActor(configured, 'bounded-codex', captured);
      const boundedHandoff = bounded.observeHandoff?.bind(bounded);
      assert.ok(boundedHandoff);
      await expect(
        boundedHandoff({ options: enabledOptions, currentTool: true }),
      ).rejects.toMatchObject({
        grade: { exit: 2 },
      });
      const mismatch = JSON.parse(
        readFileSync(nodePath.join(captured, 'bounded-codex-1-handoff-mismatch.json'), 'utf8'),
      );
      expect(mismatch.decisions).toEqual([
        expect.objectContaining({
          decision: 'block',
          reason: expect.stringContaining('terminal-handoff/v1 correction'),
        }),
      ]);
      expect(JSON.parse(mismatch.raw).observations).toHaveLength(1);
      rmSync(nodePath.join(root, 'terminal-fault'));
      for (const [fault, reason] of [
        ['extra', 'CODEX_HANDOFF_RESPONSE_COUNT_MISMATCH'],
        ['missing', 'CODEX_HANDOFF_RESPONSE_COUNT_MISMATCH'],
        ['phase', 'handoff terminal provenance missing'],
        ['turn', 'handoff terminal provenance missing'],
        ['text', 'CODEX_HANDOFF_MESSAGE_MISMATCH'],
        ['event', 'CODEX_HANDOFF_TRANSCRIPT_EVENT_MISMATCH'],
        ['stop-extra', 'CODEX_HANDOFF_CONTINUATION_BOUND_MISMATCH'],
        ['completed', 'CODEX_HANDOFF_TURN_COMPLETION_MISSING'],
      ] as const) {
        writeFileSync(nodePath.join(root, 'terminal-fault'), fault);
        await expect(
          actor.observeVerification(`${scope}\n${marker}\n`, { enabled: true, currentTool: true }),
        ).rejects.toThrow(reason);
      }
      rmSync(nodePath.join(root, 'terminal-fault'));
      writeFileSync(nodePath.join(root, 'skip-helper'), '');
      await expect(
        actor.observeVerification(`${scope}\n${marker}\n`, { enabled: true, currentTool: true }),
      ).rejects.toThrow('NATIVE_HANDOFF_HELPER_MISSING');
      rmSync(nodePath.join(root, 'skip-helper'));
      writeFileSync(nodePath.join(root, 'wrong-reason'), '');
      await expect(
        actor.observeVerification(`${scope}\n${marker}\n`, { enabled: true, currentTool: true }),
      ).rejects.toThrow('CODEX_HANDOFF_REASON_MISMATCH');
      rmSync(nodePath.join(root, 'wrong-reason'));
      const next = 'VERIFICATION_bb-cc';
      requirePropagationVerificationMarker(inputs, next);
      await actor.refreshResources({ ...inputs, sourcePackage });
      expect(actor.preparedFixture()).toEqual(prepared);
      expect(existsSync(nodePath.join(prepared.installedPath, 'plugin.json'))).toBe(false);
      const deniedRefresh = await actor.observeVerification(`${scope}\n${marker}\n`);
      expect(deniedRefresh.decisions[0].reason).toContain(next);
      const allowedRefresh = await actor.observeVerification(`${scope}\n${marker}\n${next}\n`);
      expect(allowedRefresh.decisions).toEqual([{}]);
      const calls = readFileSync(nodePath.join(root, 'model-calls'), 'utf8');
      writeFileSync(nodePath.join(root, 'untrusted'), '');
      await expect(actor.observeVerification(`${scope}\n${marker}\n`)).rejects.toThrow(
        'exact prepared fixture requires native hook trust',
      );
      await expect(
        actor.observeVerification(`${scope}\n${marker}\n`, { enabled: true, currentTool: true }),
      ).rejects.toThrow('exact prepared fixture requires native hook trust');
      await expect(
        configuredHandoff({ options: enabledOptions, currentTool: true }),
      ).rejects.toThrow('exact prepared fixture requires native hook trust');
      expect(readFileSync(nodePath.join(root, 'model-calls'), 'utf8')).toBe(calls);
      rmSync(nodePath.join(root, 'untrusted'));
      writeFileSync(nodePath.join(root, 'omit'), '');
      await expect(actor.observeVerification(`${scope}\n${marker}\n`)).rejects.toThrow(
        'native Codex Stop missing',
      );
      await expect(
        actor.observeVerification(`${scope}\n${marker}\n`, { enabled: true, currentTool: true }),
      ).rejects.toThrow('native Codex Stop missing');
      const observedPath = JSON.parse(allowed.installation)[0] as string;
      expect(readFileSync(nodePath.join(observedPath, 'runtime/cli.js'), 'utf8')).toContain(marker);
      const enabled = combinations[1];
      assert.ok(enabled);
      await expect(configuredHandoff({ options: enabled, currentTool: true })).rejects.toThrow(
        'native Codex Stop missing',
      );
      rmSync(nodePath.join(root, 'omit'));
      const policyCalls = vi.spyOn(actor, 'observeVerification');
      const retainedPolicy = await retainNativeResourceActor(actor).observeVerification(
        `${scope}\n${marker}\n${next}\n`,
        'not-a-handoff-option',
      );
      expect(policyCalls).toHaveBeenLastCalledWith(`${scope}\n${marker}\n${next}\n`);
      policyCalls.mockRestore();
      expect(retainedPolicy.protocol).toBe('stop-json');
      assert.ok(retainedPolicy.protocol === 'stop-json');
      expect(retainedPolicy.observation.decisions).toEqual([{}]);
      expect(retainedPolicy.observation.installation).toBe(allowed.installation);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
  120_000,
);

async function characterizeArchitecture(
  actor: CodexNativeCatalogueActor,
  root: string,
  evidence: string,
  installation: string,
) {
  const directory = nodePath.join(root, 'architecture-capture');
  mkdirSync(directory);
  const retained = retainNativeResourceActor(actor);
  const captured = captureNativePropagationActor(retained, 'architecture-codex', directory);
  const before = retained.fingerprint();
  const result = await runArchitectureSettings(captured, evidence);
  expect(result.exit, 'CODEX_RETAINED_ARCHITECTURE_UNWIRED').toBe(0);
  expect(result.failures).toEqual([]);
  expect(result.observations).toHaveLength(6);
  expect(retained.fingerprint()).toEqual(before);
  const records = readFileSync(nodePath.join(directory, 'observations.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map(line => JSON.parse(line));
  expect(records).toHaveLength(6);
  for (const [index, actual] of result.observations.entries()) {
    assert.ok(actual.protocol === 'stop-json' && actual.observation.configuration);
    const observed = actual.observation;
    expect(observed.installation).toBe(installation);
    expect(observed.ticket).toMatch(/^phase: verify$/mu);
    const options = combinations[index];
    assert.ok(options && observed.configuration);
    expect(JSON.parse(observed.configuration.bytes)).toMatchObject(options);
    const raw = JSON.parse(observed.raw);
    expect(raw.configurationAfter).toBe(observed.configuration.bytes);
    expect(raw.observations[0].input.session_id).toBe('source-thread');
    expect(raw.observations[0].args).toContain(
      nodePath.join(JSON.parse(installation)[0], 'runtime/cli.js'),
    );
    expect(JSON.parse(readFileSync(records[index].observation_artifact, 'utf8'))).toEqual(observed);
  }
  const dropped = await runArchitectureSettings(
    {
      ...captured,
      observeVerification: (value, setup, setting) => {
        assert.ok(setting);
        return captured.observeVerification(value, setup, {
          ...setting,
          options: { ...setting.options, architectureReviewGate: false },
        });
      },
    },
    evidence,
  );
  expect(dropped.exit).toBe(2);
  expect(dropped.failures).toContain('PROPAGATION_ARCHITECTURE_SETTING:2:CONFIGURATION_MISMATCH');
  const bypassed = await runArchitectureSettings(
    {
      ...captured,
      observeVerification: (value, setup) => captured.observeVerification(value, setup),
    },
    evidence,
  );
  expect(bypassed.exit).toBe(3);
  expect(bypassed.failures).toContain('PROPAGATION_ARCHITECTURE_SETTING:0:UNOBSERVED');
  const options = combinations[2];
  assert.ok(options);
  const setting = { kind: 'architecture-review' as const, options: { ...options } };
  writeFileSync(nodePath.join(root, 'change-config'), '');
  await expect(captured.observeVerification(evidence, evidence, setting)).rejects.toThrow(
    'settings changed during native turn',
  );
  rmSync(nodePath.join(root, 'change-config'));
  writeFileSync(nodePath.join(root, 'architecture-wrong-evidence'), '');
  await expect(captured.observeVerification(evidence, evidence, setting)).rejects.toMatchObject({
    grade: { exit: 2 },
  });
  rmSync(nodePath.join(root, 'architecture-wrong-evidence'));
  const ledger = readFileSync(nodePath.join(directory, 'observations.jsonl'), 'utf8')
    .trim()
    .split('\n');
  const last = ledger.at(-1);
  assert.ok(last);
  const mismatch = JSON.parse(readFileSync(JSON.parse(last).observation_artifact, 'utf8'));
  expect(mismatch.ticket).toMatch(/^type: feature$/mu);
  expect(JSON.parse(mismatch.raw).observations).toHaveLength(1);
  expect(mismatch.decisions[0].reason).not.toContain('cited evidence');
  expect(mismatch.decisions[0].reason).toContain('no independent design review');
  for (const [fault, reason] of [
    ['foreign-session', 'source-thread'],
    ['missing-turn', 'architecture turn provenance missing'],
  ] as const) {
    writeFileSync(nodePath.join(root, fault), '');
    await expect(captured.observeVerification(evidence, evidence, setting)).rejects.toThrow(reason);
    rmSync(nodePath.join(root, fault));
  }
  writeFileSync(nodePath.join(root, 'omit'), '');
  await expect(captured.observeVerification(evidence, evidence, setting)).rejects.toThrow(
    'native Codex Stop missing',
  );
  rmSync(nodePath.join(root, 'omit'));
  expect(
    readFileSync(nodePath.join(directory, 'observations.jsonl'), 'utf8').trim().split('\n'),
  ).toHaveLength(ledger.length);
}
