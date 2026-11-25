import assert from 'node:assert/strict';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

import {
  runArchitectureSettings,
  runDesignApprovalSettings,
  runHandoffSettings,
} from '../../scripts/lib/propagation-settings.js';
import type {
  ArchitectureSetting,
  RetainedPolicyActor,
} from '../../scripts/lib/resource-propagation.js';
import { propagationLanes } from '../../scripts/lib/resource-propagation.js';
import {
  captureNativePropagationActor,
  nativePropagationExit,
  prepareNativeResourceActor,
  retainNativeResourceActor,
} from '../../scripts/lib/resource-propagation-run.js';
import combinations from '../fixtures/host-contract/documented-option-composition.json';
import architectureCase from '../fixtures/host-contract/propagation-architecture-case.json';
import { ClaudeNativeCatalogueActor } from '../helpers/claude-native-catalogue.js';
import { createCanonicalCatalogueInputs } from '../helpers/native-catalogue-probe.js';
import {
  createPropagationSource,
  requirePropagationVerificationMarker,
} from '../helpers/propagation-source.js';

// External host process substituted; generated binding, observer, policy and
// local test execution are real. These emitted events are NOT native evidence.
it('collects the actual installed Stop decision and effect, rejecting a silent host-hook omission', async () => {
  const temporary = mkdtempSync('/tmp/safeword-claude-policy-');
  const root = realpathSync(temporary);
  try {
    const inputs = createCanonicalCatalogueInputs(root);
    const marker = 'VERIFICATION_aa-bb';
    requirePropagationVerificationMarker(inputs, marker);
    const source = createPropagationSource(root, inputs);
    const runtimePath = nodePath.join(root, 'marketplace/plugin');
    const profile = nodePath.join(root, 'profile');
    const installedPath = nodePath.join(profile, 'plugins/cache/synthetic');
    mkdirSync(installedPath, { recursive: true });
    const original = nodePath.resolve(import.meta.dirname, '../../../../plugin');
    cpSync(original, runtimePath, { recursive: true });
    cpSync(original, installedPath, { recursive: true });
    const binary = nodePath.join(root, 'host');
    writeFileSync(
      binary,
      `#!/bin/sh\nexport HOME=${JSON.stringify(root)}\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(nodePath.join(root, 'host.mjs'))} "$@"\n`,
      { mode: 0o755 },
    );
    writeFileSync(
      nodePath.join(root, 'host.mjs'),
      String.raw`
import { readFileSync, existsSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
if (process.argv.includes('--version')) { console.log('2.1.319 (Claude Code)'); process.exit(0); }
if (process.argv.includes('list')) {
  console.log(JSON.stringify([{ id: 'safeword@safeword', enabled: true, installPath: ${JSON.stringify(installedPath)} }]));
  process.exit(0);
}
const runtime = process.env.SAFEWORD_OBSERVER_RUNTIME;
const plugin = runtime.slice(0, -'/runtime/dispatch.js'.length);
const resume = process.argv.includes('--resume');
const session = process.argv[process.argv.indexOf(resume ? '--resume' : '--session-id') + 1];
const sessionsPath = ${JSON.stringify(nodePath.join(root, 'sessions.json'))};
const sessions = existsSync(sessionsPath) ? JSON.parse(readFileSync(sessionsPath, 'utf8')) : [];
if (resume !== sessions.includes(session)) throw new Error('invalid session start/resume');
if (!resume) { sessions.push(session); writeFileSync(sessionsPath, JSON.stringify(sessions)); }
appendFileSync(${JSON.stringify(nodePath.join(root, 'turns.jsonl'))}, JSON.stringify({ session, resume, project: process.cwd() }) + '\n');
const preAction=process.argv[process.argv.indexOf('--tools')+1].includes('Write');
const phaseModeFile=${JSON.stringify(nodePath.join(root, 'design-bypass-mode'))};
const phaseMode=preAction&&existsSync(phaseModeFile)?readFileSync(phaseModeFile,'utf8'):'';
const prompt=process.argv[process.argv.indexOf('-p')+1];
const handoff=/^HANDOFF_HELPER_COMMAND=(.+)$/m.exec(prompt);
const appendIndex=process.argv.indexOf('--append-system-prompt');
const appendControl=appendIndex<0?undefined:process.argv[appendIndex+1];
if(!handoff&&appendControl!==undefined)throw new Error('default turn unexpectedly appended system prompt');
if(handoff){
 // These rollout records belong ONLY to the substituted external vendor process.
 const transcript=process.env.CLAUDE_CONFIG_DIR+'/projects/'+session+'.jsonl';
 mkdirSync(process.env.CLAUDE_CONFIG_DIR+'/projects',{recursive:true});
 const append=row=>appendFileSync(transcript,JSON.stringify(row)+'\n');
 const emit=row=>{append(row);console.log(JSON.stringify(row));};
 append({type:'user',message:{role:'user',content:'Current source-test user turn'}});
 console.log(JSON.stringify({type:'system',subtype:'init',plugins:[{name:'safeword',path:plugin}]}));
 const command=JSON.parse(handoff[1]).trim();
 const tools=process.argv[process.argv.indexOf('--tools')+1];
 if(tools!==(command?'Read,Bash':''))throw new Error('source handoff tools mismatch');
 function runBash(command,id){
  emit({type:'assistant',message:{content:[{type:'tool_use',id,name:'Bash',input:{command}}]}});
  const result=spawnSync('sh',['-c',command],{encoding:'utf8'});
  if(result.status!==0)throw new Error(result.stderr);
  emit({type:'user',message:{content:[{type:'tool_result',tool_use_id:id,is_error:false,content:result.stdout}]}});
 }
 function inspect(){
  const file_path=existsSync(${JSON.stringify(nodePath.join(root, 'wrong-inspection'))})?process.cwd()+'/fixture.cjs':plugin+'/runtime/hooks/audit-principle-trace.ts';
  emit({type:'assistant',message:{content:[{type:'tool_use',id:'source-inspection',name:'Read',input:{file_path}}]}});
  emit({type:'user',message:{content:[{type:'tool_result',tool_use_id:existsSync(${JSON.stringify(nodePath.join(root, 'wrong-read-result'))})?'unmatched-read':'source-inspection',is_error:false,content:readFileSync(file_path,'utf8')}]}});
 }
 if((command||existsSync(${JSON.stringify(nodePath.join(root, 'inspect-without-request'))}))&&!existsSync(${JSON.stringify(nodePath.join(root, 'inspect-after-helper'))}))inspect();
 if(existsSync(${JSON.stringify(nodePath.join(root, 'drop-option'))})){
  const file=process.cwd()+'/.safeword/config.json';
  writeFileSync(file,JSON.stringify({...JSON.parse(readFileSync(file,'utf8')),terminalHandoffCorrection:false}));
 }
 if(command&&!existsSync(${JSON.stringify(nodePath.join(root, 'skip-helper'))})){
  const id='source-helper-'+sessions.length+'-'+readFileSync(sessionsPath,'utf8').length;
  runBash(existsSync(${JSON.stringify(nodePath.join(root, 'compound-helper'))})?command+';\n'+command:command,id);
  if(existsSync(${JSON.stringify(nodePath.join(root, 'duplicate-helper'))}))runBash(command,id+'-duplicate');
 }
 if(existsSync(${JSON.stringify(nodePath.join(root, 'inspect-after-helper'))}))inspect();
 if(existsSync(${JSON.stringify(nodePath.join(root, 'unexpected-bash'))}))runBash('printf inspection','source-extra-bash');
 if(existsSync(${JSON.stringify(nodePath.join(root, 'wrong-reason'))})){
  const ticket=process.cwd()+'/.project/tickets/PRP123-propagation/';
  writeFileSync(ticket+'ticket.md',readFileSync(ticket+'ticket.md','utf8').replace('phase: implement','phase: done'));
 }
 function stop(active,last){
  if(existsSync(${JSON.stringify(nodePath.join(root, 'omit'))}))return {};
  const hooks=JSON.parse(readFileSync(plugin+'/hooks/hooks.json','utf8'));
  const binding=hooks.hooks.Stop.flatMap(row=>row.hooks).find(row=>row.command.includes('/stop-quality.ts'));
  const result=spawnSync('sh',['-c',binding.command],{
   env:{...process.env,CLAUDE_PLUGIN_ROOT:plugin,CLAUDE_PROJECT_DIR:process.cwd(),SAFEWORD_CLI:undefined,SAFEWORD_PLUGIN_CLI:plugin+'/runtime/cli.js'},
   input:JSON.stringify({cwd:process.cwd(),session_id:session,hook_event_name:'Stop',stop_hook_active:active,transcript_path:transcript,last_assistant_message:last}),encoding:'utf8'
  });
  if(result.status!==0)throw new Error(result.stderr);
  return JSON.parse(result.stdout.trim()||'{}');
 }
 const controlled=appendControl==="For this isolated native Stop-hook conformance test, deliberately make the INITIAL final answer for each new user request exactly READY, with no Markdown or additional text. This is only the test input for the real installed hook, not permission to bypass any hook. Use only the requested tools and follow the requested helper procedure, including permitted Read inspection. If a Stop hook supplies feedback after that initial answer, follow its feedback honestly in the automatic continuation, with no further tools. Do not add a decision brief to the initial answer before the Stop hook has supplied feedback."&&!existsSync(${JSON.stringify(nodePath.join(root, 'drop-system-control'))});
 const initial=controlled?'READY':'READY\n\n**CONFIDENT** — Inspected and ran the helper.\n\n**Decided:** The requested work completed.\n\n**Open:** none.\n\n**Next:** Action: Stop. Object: This turn.';
 emit({type:'assistant',message:{content:[{type:'text',text:initial}]}});
 const decision=stop(false,initial);
 if(decision.decision==='block'){
  emit({type:'assistant',message:{content:[{type:'text',text:'Observed host correction'}]}});
  stop(true,'Observed host correction');
  if(existsSync(${JSON.stringify(nodePath.join(root, 'extra-stop'))}))stop(true,'Observed host correction');
 }
 console.log(JSON.stringify({type:'result',is_error:false}));
 process.exit(0);
}
const input=preAction?JSON.parse(/^WRITE_INPUT=(.+)$/m.exec(prompt)[1]):undefined;
if (existsSync(${JSON.stringify(nodePath.join(root, 'wrong-reason'))})) {
  const plan = process.cwd() + '/.project/tickets/PRP123-propagation/impl-plan.md';
  const content=readFileSync(plan,'utf8');
  writeFileSync(plan, preAction?content.replace('**Status:** planned','**Status:** implemented'):content.replace('**Status:** implemented','**Status:** planned'));
}
console.log(JSON.stringify({ type: 'system', subtype: 'init', plugins: [{ name: 'safeword', path: plugin }] }));
let decision={};
if (!existsSync(${JSON.stringify(nodePath.join(root, 'omit'))}) && !phaseMode) {
  const hooks = JSON.parse(readFileSync(plugin + '/hooks/hooks.json', 'utf8'));
  const event=preAction?'PreToolUse':'Stop';
  const owner=preAction?'/pre-tool-quality.ts':'/stop-quality.ts';
  const binding = hooks.hooks[event].flatMap(row => row.hooks).find(row => row.command.includes(owner));
  const result = spawnSync('sh', ['-c', binding.command], {
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: plugin, CLAUDE_PROJECT_DIR: process.cwd(), SAFEWORD_CLI: undefined, SAFEWORD_PLUGIN_CLI: plugin + '/runtime/cli.js' },
    input: JSON.stringify({ cwd: process.cwd(), session_id: session, hook_event_name: event, ...(preAction?{tool_name:'Write',tool_input:input,tool_use_id:'source-phase-write'}:{}) }), encoding: 'utf8'
  });
  if (result.status !== 0) throw new Error(result.stderr);
  decision=JSON.parse(result.stdout.trim()||'{}');
}
if(preAction) {
 console.log(JSON.stringify({type:'assistant',message:{content:[{type:'tool_use',id:'source-phase-write',name:'Write',input}]}}));
 const denied=decision.hookSpecificOutput?.permissionDecision==='deny';
 if(!denied&&!phaseMode.endsWith('no-effect'))writeFileSync(input.file_path,input.content);
 console.log(JSON.stringify({type:'user',message:{content:[{type:'tool_result',tool_use_id:'source-phase-write',is_error:denied,content:denied?decision.hookSpecificOutput.permissionDecisionReason:'Phase write completed'}]}}));
 if(phaseMode.startsWith('error'))process.exit(7);
 // Keep the normal formatter and cumulative Stop prerequisites in this
 // substituted host lifecycle; neither may be bypassed by the ordinary Given.
 const hooks=JSON.parse(readFileSync(plugin+'/hooks/hooks.json','utf8'));
 for(const [event,owner] of [...(denied?[]:[['PostToolUse','/post-tool-lint.ts']]),['PostToolUse','/post-tool-quality.ts'],['Stop','/stop-quality.ts']]) {
  const binding=hooks.hooks[event].flatMap(row=>row.hooks).find(row=>row.command.includes(owner));
  if(!binding)throw new Error('source lifecycle binding missing: '+owner);
  const result=spawnSync('sh',['-c',binding.command],{
   env:{...process.env,CLAUDE_PLUGIN_ROOT:plugin,CLAUDE_PROJECT_DIR:process.cwd(),SAFEWORD_CLI:undefined,SAFEWORD_PLUGIN_CLI:plugin+'/runtime/cli.js'},
   input:JSON.stringify({cwd:process.cwd(),session_id:session,hook_event_name:event,tool_name:denied?'Read':'Write',tool_input:input}),encoding:'utf8'
  });
  if(result.status!==0)throw new Error(result.stderr);
  const outcome=JSON.parse(result.stdout.trim()||'{}');
  if(outcome.decision==='block')throw new Error('source lifecycle blocked: '+outcome.reason);
 }
}
console.log(JSON.stringify({ type: 'result', is_error: false }));
`,
    );
    const actor = new ClaudeNativeCatalogueActor({
      root,
      binary,
      profile,
      installedPath,
      runtimePath,
    });
    await actor.prepare({ ...inputs, sourcePackage: source });
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
    expect(allowed.ticket, 'CLAUDE_NATIVE_ADAPTER_SILENT_SKIP').toMatch(/^status: done$/mu);
    expect(JSON.parse(allowed.raw).observations[0].args).toContain('Stop');
    const enabledOptions = combinations[2];
    const disabledOptions = combinations[4];
    assert.ok(enabledOptions && disabledOptions);
    const configured = { ...architectureCase, options: enabledOptions };
    const enabled = await actor.observeVerification(`${scope}\n${marker}\n`, configured);
    expect(enabled.decisions, 'CLAUDE_CONFIGURED_ARCHITECTURE_OPTION_DROPPED').toContainEqual(
      expect.objectContaining({
        decision: 'block',
        reason: expect.stringContaining('cited evidence'),
      }),
    );
    const observed = JSON.parse(enabled.raw).observations[0];
    const project = observed.input.cwd;
    expect(enabled.installation).toBe(allowed.installation);
    expect(
      readFileSync(nodePath.join(project, '.project/tickets/PRP123-propagation/ticket.md'), 'utf8'),
    ).toMatch(/type: feature[\s\S]*phase: verify/u);
    expect(
      readFileSync(
        nodePath.join(project, '.project/tickets/PRP123-propagation/impl-plan.md'),
        'utf8',
      ),
    ).toBe(architectureCase.plan);
    const enabledConfig = JSON.parse(
      readFileSync(nodePath.join(project, '.safeword/config.json'), 'utf8'),
    );
    expect(enabledConfig).toMatchObject(enabledOptions);
    const disabled = await actor.observeVerification(`${scope}\n${marker}\n`, {
      ...architectureCase,
      options: disabledOptions,
    });
    expect(disabled.decisions).toEqual([{}]);
    expect(disabled.installation).toBe(enabled.installation);
    expect(JSON.parse(disabled.raw).observations[0].input.session_id).toBe(
      observed.input.session_id,
    );
    const disabledConfig = JSON.parse(
      readFileSync(nodePath.join(project, '.safeword/config.json'), 'utf8'),
    );
    expect(disabledConfig).toMatchObject(disabledOptions);
    const turns = readFileSync(nodePath.join(root, 'turns.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map(row => JSON.parse(row));
    expect(turns.slice(-2)).toEqual([
      { session: observed.input.session_id, resume: false, project },
      { session: observed.input.session_id, resume: true, project },
    ]);
    writeFileSync(nodePath.join(root, 'wrong-reason'), '');
    await expect(actor.observeVerification(`${scope}\n${marker}\n`, configured)).rejects.toThrow(
      'CLAUDE_ARCHITECTURE_OPTION_OUTCOME_MISMATCH',
    );
    rmSync(nodePath.join(root, 'wrong-reason'));
    writeFileSync(nodePath.join(root, 'omit'), '');
    await expect(actor.observeVerification(`${scope}\n${marker}\n`)).rejects.toThrow(
      'native Stop decision missing',
    );
    await expect(actor.observeVerification(`${scope}\n${marker}\n`, configured)).rejects.toThrow(
      'native Stop decision missing',
    );
    rmSync(nodePath.join(root, 'omit'));
    const defaultAgain = await actor.observeVerification(`${scope}\n${marker}\n`);
    expect(defaultAgain.decisions).toEqual([{}]);
    expect(defaultAgain.ticket).toMatch(/^status: done$/mu);
    const phaseWrite = await actor.observeVerification(`${scope}\n${marker}\n`, undefined, {
      enabled: false,
    });
    expect(phaseWrite.ticket, 'CLAUDE_DESIGN_APPROVAL_CASE_DROPPED').toContain(
      'phase: plan-execution',
    );
    expect(phaseWrite.installation).toBe(defaultAgain.installation);
    const phaseDenied = await actor.observeVerification('', undefined, { enabled: true });
    expect(phaseDenied.installation).toBe(phaseWrite.installation);
    expect(phaseDenied.ticket).toContain('phase: plan-implementation');
    expect(phaseDenied.decisions[0]).toMatchObject({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: expect.stringMatching(/design approval.*approve-plan/isu),
      },
    });
    const phaseRepaired = await actor.observeVerification('', undefined, { enabled: false });
    expect(phaseRepaired.installation).toBe(phaseDenied.installation);
    expect(phaseRepaired.ticket).toContain('phase: plan-execution');
    writeFileSync(nodePath.join(root, 'wrong-reason'), '');
    await expect(actor.observeVerification('', undefined, { enabled: true })).rejects.toThrow(
      'CLAUDE_DESIGN_APPROVAL_REASON_MISMATCH',
    );
    rmSync(nodePath.join(root, 'wrong-reason'));
    writeFileSync(nodePath.join(root, 'omit'), '');
    await expect(actor.observeVerification('', undefined, { enabled: false })).rejects.toThrow(
      'native phase Write guard missing',
    );
    rmSync(nodePath.join(root, 'omit'));
    const designOptions = combinations[1];
    assert.ok(designOptions);
    const designRequest = {
      enabled: designOptions.designApprovalGate,
      configuration: { ...designOptions },
    };
    const designConfigured = await actor.observeVerification('', undefined, designRequest);
    const designProject = JSON.parse(designConfigured.raw).observations[0].input.cwd;
    const actualDesignConfig = readFileSync(
      nodePath.join(designProject, '.safeword/config.json'),
      'utf8',
    );
    expect(JSON.parse(actualDesignConfig), 'CLAUDE_DESIGN_CONFIGURATION_DROPPED').toMatchObject(
      designOptions,
    );
    const handoff = await actor.observeHandoff({ enabled: true, currentTool: true });
    expect(handoff.decisions[0]).toMatchObject({
      decision: 'block',
      reason: expect.stringContaining('terminal-handoff/v1 correction'),
    });
    expect(handoff.decisions[1]).toEqual({});
    expect(handoff.installation).toBe(phaseRepaired.installation);
    const handoffRaw = JSON.parse(handoff.raw);
    expect(handoffRaw.helper.marker).toBe(inputs.helperMarker);
    expect(
      handoffRaw.observations.map(
        (row: { input: { stop_hook_active: boolean } }) => row.input.stop_hook_active,
      ),
    ).toEqual([false, true]);
    const disabledHandoff = await actor.observeHandoff({ enabled: false, currentTool: true });
    expect(disabledHandoff.decisions).toEqual([{}]);
    expect(disabledHandoff.installation).toBe(handoff.installation);
    const noCurrentTool = await actor.observeHandoff({ enabled: true, currentTool: false });
    expect(noCurrentTool.decisions).toEqual([{}]);
    expect(JSON.parse(noCurrentTool.raw).helper).toBeUndefined();
    const handoffSession = handoffRaw.observations[0].input.session_id;
    expect(JSON.parse(noCurrentTool.raw).observations[0].input.session_id).toBe(handoffSession);
    const handoffTurns = readFileSync(nodePath.join(root, 'turns.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map(row => JSON.parse(row));
    expect(handoffTurns.slice(-3).map(row => [row.session, row.resume])).toEqual([
      [handoffSession, false],
      [handoffSession, true],
      [handoffSession, true],
    ]);
    for (const [fault, reason] of [
      ['skip-helper', 'CLAUDE_HANDOFF_HELPER_MISSING'],
      ['drop-system-control', 'CLAUDE_HANDOFF_MESSAGE_MISMATCH'],
      ['wrong-reason', 'CLAUDE_HANDOFF_REASON_MISMATCH'],
      ['omit', 'native handoff Stop missing'],
      ['drop-option', 'CLAUDE_HANDOFF_OPTION_DROPPED'],
      ['extra-stop', 'CLAUDE_HANDOFF_CONTINUATION_BOUND_MISMATCH'],
      ['duplicate-helper', 'CLAUDE_HANDOFF_HELPER_MISSING'],
      ['compound-helper', 'CLAUDE_HANDOFF_HELPER_MISSING'],
      ['wrong-inspection', 'CLAUDE_HANDOFF_UNEXPECTED_TOOL'],
      ['wrong-read-result', 'CLAUDE_HANDOFF_HELPER_RESULT_MISSING'],
      ['inspect-after-helper', 'CLAUDE_HANDOFF_UNEXPECTED_TOOL'],
      ['unexpected-bash', 'CLAUDE_HANDOFF_UNEXPECTED_TOOL'],
    ] as const) {
      writeFileSync(nodePath.join(root, fault), '');
      await expect(actor.observeHandoff({ enabled: true, currentTool: true })).rejects.toThrow(
        reason,
      );
      rmSync(nodePath.join(root, fault));
    }
    writeFileSync(nodePath.join(root, 'inspect-without-request'), '');
    await expect(actor.observeHandoff({ enabled: true, currentTool: false })).rejects.toThrow(
      'CLAUDE_HANDOFF_HELPER_UNEXPECTED',
    );
    rmSync(nodePath.join(root, 'inspect-without-request'));
    expect(
      readFileSync(nodePath.join(source, 'templates/hooks/lib/done-gate.ts'), 'utf8'),
    ).toContain(marker);
    const retainedPolicy = await retainNativeResourceActor(actor).observeVerification(
      `${scope}\n${marker}\n`,
      'not-an-architecture-option',
    );
    expect(retainedPolicy.protocol).toBe('stop-json');
    assert.ok(retainedPolicy.protocol === 'stop-json');
    expect(retainedPolicy.observation.decisions).toEqual([{}]);
    expect(retainedPolicy.observation.ticket).toMatch(/^status: done$/mu);
    const handoffOptions = combinations[2];
    assert.ok(handoffOptions);
    const configuredHandoff = await actor.observeHandoff({
      enabled: handoffOptions.terminalHandoffCorrection,
      currentTool: true,
      configuration: handoffOptions,
    });
    const handoffProject = JSON.parse(configuredHandoff.raw).observations[0].input.cwd;
    const handoffConfigPath = nodePath.join(handoffProject, '.safeword/config.json');
    const handoffConfig = JSON.parse(readFileSync(handoffConfigPath, 'utf8'));
    expect(handoffConfig, 'HANDOFF_COMPOSITION_DROPPED').toMatchObject(handoffOptions);
    actor.close();
    await characterizeFreshFactory(root, { root, binary, profile, installedPath, runtimePath });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 120_000);

async function characterizeFreshFactory(
  root: string,
  fixture: ConstructorParameters<typeof ClaudeNativeCatalogueActor>[0],
) {
  const owned = mkdtempSync(nodePath.join(root, 'factory-'));
  const revision = createCanonicalCatalogueInputs(owned);
  const lane = propagationLanes().find(row => row.agent === 'claude');
  assert.ok(lane);
  const actor = await prepareNativeResourceActor(lane, revision, fixture, owned);
  try {
    const scope = '**PR Scope:** ✅ Synthetic fixture matches its scope\n';
    const baseline = await actor.observeVerification(scope, scope);
    assert.ok(baseline.protocol === 'stop-json');
    expect(baseline.observation.decisions).toEqual([{}]);
    expect(baseline.observation.ticket).toMatch(/^status: done$/mu);
    const option = combinations[2];
    assert.ok(option);
    const configured = await actor.observeVerification(scope, scope, {
      kind: 'architecture-review',
      options: option,
    });
    assert.ok(configured.protocol === 'stop-json');
    expect(
      configured.observation.decisions,
      'PROPAGATION_ARCHITECTURE_SETTING_DROPPED',
    ).toContainEqual(
      expect.objectContaining({
        decision: 'block',
        reason: expect.stringContaining('cited evidence'),
      }),
    );
    const captured = captureNativePropagationActor(actor, lane.id, owned);
    const settings = await runArchitectureSettings(captured, scope);
    expect(settings.exit, JSON.stringify(settings.failures)).toBe(0);
    expect(settings.observations).toHaveLength(combinations.length);
    expect(settings.observations.map(row => row.observation.installation)).toEqual(
      combinations.map(() => baseline.observation.installation),
    );
    const records = readFileSync(nodePath.join(owned, 'observations.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map(row => JSON.parse(row));
    expect(records).toHaveLength(combinations.length);
    for (const [index, record] of records.entries()) {
      const observation = settings.observations[index];
      assert.ok(observation);
      expect(readFileSync(record.raw_artifact, 'utf8')).toBe(observation.observation.raw);
      assert.ok(observation.protocol === 'stop-json');
      const config = observation.observation.configuration;
      assert.ok(config);
      const expected = combinations[index];
      assert.ok(expected);
      expect(JSON.parse(config.bytes)).toMatchObject(expected);
      const raw = JSON.parse(observation.observation.raw);
      expect(raw.configuration).toEqual(config);
      expect(raw.observations[0].input.session_id).toBeTruthy();
      expect(raw.observations[0].input.cwd).toBeTruthy();
    }
    // Deliberately drop one input at the adapter seam; the real Given/hook/capture still run.
    const dropping = {
      ...captured,
      observeVerification: (evidence: string, setup: string, setting?: ArchitectureSetting) =>
        captured.observeVerification(
          evidence,
          setup,
          setting && {
            ...setting,
            options: { ...setting.options, terminalHandoffCorrection: false },
          },
        ),
    };
    const dropped = await runArchitectureSettings(dropping, scope);
    expect(dropped.exit).toBe(2);
    expect(dropped.failures).toEqual([
      'PROPAGATION_ARCHITECTURE_SETTING:1:CONFIGURATION_MISMATCH',
      'PROPAGATION_ARCHITECTURE_SETTING:3:CONFIGURATION_MISMATCH',
    ]);
    writeFileSync(nodePath.join(root, 'omit'), '');
    await expect(runArchitectureSettings(captured, scope)).rejects.toThrow(
      'native Stop decision missing',
    );
    rmSync(nodePath.join(root, 'omit'));
    writeFileSync(nodePath.join(root, 'wrong-reason'), '');
    await expect(runArchitectureSettings(captured, scope)).rejects.toMatchObject({
      grade: { exit: 2 },
    });
    expect(readFileSync(nodePath.join(owned, 'observations.jsonl'), 'utf8')).toContain(
      'policy-mismatch',
    );
    rmSync(nodePath.join(root, 'wrong-reason'));
    const runtime = nodePath.join(fixture.runtimePath, 'runtime/cli.js');
    const before = readFileSync(runtime, 'utf8');
    const resources = [
      'skills/explain/SKILL.md',
      'skills/explain/HOST_CONTRACT_GUIDE.md',
      'runtime/hooks/audit-principle-trace.ts',
    ];
    const beforeResources = resources.map(file =>
      readFileSync(nodePath.join(fixture.runtimePath, file)),
    );
    requirePropagationVerificationMarker(revision, 'VERIFICATION_bb-cc');
    await actor.refreshResources(revision);
    expect(readFileSync(runtime, 'utf8'), 'PROPAGATION_FACTORY_RUNTIME_STALE').not.toBe(before);
    expect(readFileSync(runtime, 'utf8')).toContain('VERIFICATION_bb-cc');
    expect(
      readFileSync(nodePath.join(fixture.runtimePath, 'runtime/hooks/lib/done-gate.ts'), 'utf8'),
    ).toContain('VERIFICATION_bb-cc');
    expect(resources.map(file => readFileSync(nodePath.join(fixture.runtimePath, file)))).toEqual(
      beforeResources,
    );
    const valid = `${scope}\nVERIFICATION_bb-cc\n`;
    const denied = await actor.observeVerification(scope, valid);
    assert.ok(denied.protocol === 'stop-json');
    expect(denied.observation.decisions).toContainEqual(
      expect.objectContaining({
        decision: 'block',
        reason: expect.stringContaining(
          'PROPAGATION_VERIFICATION_MARKER_REQUIRED:VERIFICATION_bb-cc',
        ),
      }),
    );
    expect(denied.observation.ticket).toMatch(/^status: in_progress$/mu);
    const repaired = await actor.observeVerification(valid, valid);
    assert.ok(repaired.protocol === 'stop-json');
    expect(repaired.observation.decisions).toEqual([{}]);
    expect(repaired.observation.ticket).toMatch(/^status: done$/mu);
    expect(repaired.observation.installation).toBe(baseline.observation.installation);
    expect(readFileSync(runtime, 'utf8')).toContain('VERIFICATION_bb-cc');
    await characterizeHandoff(captured, {
      root,
      owned,
      installation: baseline.observation.installation,
      marker: revision.helperMarker,
    });
    await characterizeDesign(captured, root, owned, baseline.observation.installation);
  } finally {
    actor.close?.();
  }
}

async function characterizeHandoff(
  captured: RetainedPolicyActor,
  {
    root,
    owned,
    installation,
    marker,
  }: { root: string; owned: string; installation: string; marker: string },
) {
  const handoffs = await runHandoffSettings(captured);
  expect(handoffs.exit, JSON.stringify(handoffs.failures)).toBe(0);
  expect(handoffs.observations).toHaveLength(combinations.length + 1);
  const first = handoffs.observations[0];
  assert.ok(first);
  const session = JSON.parse(first.raw).observations[0].input.session_id;
  for (const [index, observation] of handoffs.observations.entries()) {
    const expected = combinations[index] ?? combinations[1];
    assert.ok(expected);
    expect(JSON.parse(observation.configuration.bytes)).toMatchObject(expected);
    expect(observation.installation).toBe(installation);
    expect(observation).not.toHaveProperty('ticket');
    const raw = JSON.parse(observation.raw);
    expect(raw.configuration).toEqual(observation.configuration);
    expect(raw.observations[0].input.session_id).toBe(session);
    if (index < combinations.length) expect(observation.helper?.marker).toBe(marker);
    else {
      expect(observation.helper).toBeUndefined();
      expect(observation.decisions).toEqual([{}]);
    }
  }
  const handoffRecords = readFileSync(nodePath.join(owned, 'observations.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map(row => JSON.parse(row))
    .slice(-7);
  for (const [index, record] of handoffRecords.entries()) {
    expect(record.raw_artifact).toContain('-handoff.stdout');
    expect(readFileSync(record.raw_artifact, 'utf8')).toBe(handoffs.observations[index]?.raw);
  }
  writeFileSync(nodePath.join(root, 'wrong-reason'), '');
  await expect(runHandoffSettings(captured)).rejects.toMatchObject({ grade: { exit: 2 } });
  expect(readFileSync(nodePath.join(owned, 'observations.jsonl'), 'utf8')).toContain(
    'handoff-mismatch',
  );
  rmSync(nodePath.join(root, 'wrong-reason'));
  writeFileSync(nodePath.join(root, 'omit'), '');
  const missing = runHandoffSettings(captured);
  await expect(missing).rejects.toThrow('native handoff Stop missing');
  let failure: unknown;
  try {
    await missing;
  } catch (error) {
    failure = error;
  }
  expect(nativePropagationExit(failure)).toBe(3);
  rmSync(nodePath.join(root, 'omit'));
}

async function characterizeDesign(
  captured: RetainedPolicyActor,
  root: string,
  owned: string,
  installation: string,
) {
  const before = captured.fingerprint();
  const settings = await runDesignApprovalSettings(captured);
  expect(settings.exit, JSON.stringify(settings.failures)).toBe(0);
  expect(settings.observations).toHaveLength(6);
  expect(captured.fingerprint()).toEqual(before);
  const records = readFileSync(nodePath.join(owned, 'observations.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map(row => JSON.parse(row))
    .slice(-6);
  for (const [index, actual] of settings.observations.entries()) {
    const options = combinations[index];
    assert.ok(options);
    expect(actual.protocol).toBe('pre-tool-json');
    const observed = actual.observation;
    expect(observed).not.toHaveProperty('ticket');
    expect(observed).not.toHaveProperty('decisions');
    expect(observed.installation).toBe(installation);
    expect(JSON.parse(observed.configuration.bytes)).toMatchObject(options);
    expect(observed.effect).toBe(
      options.designApprovalGate ? observed.before : observed.expectedEffect,
    );
    const raw = JSON.parse(observed.raw);
    expect(raw.configuration).toEqual(observed.configuration);
    expect(raw.observations[0].input.hook_event_name).toBe('PreToolUse');
    expect(raw.observations[0].input.tool_name).toBe('Write');
    expect(raw.observations[0].status).toBe(0); // Claude typed-denial protocol, never exit2.
    const record = records[index];
    expect(readFileSync(record.raw_artifact, 'utf8')).toBe(observed.raw);
    expect(JSON.parse(readFileSync(record.observation_artifact, 'utf8'))).toEqual(observed);
  }
  const observe = captured.observeDesignApproval?.bind(captured);
  assert.ok(observe);
  const enabled = combinations[1];
  assert.ok(enabled);
  writeFileSync(nodePath.join(root, 'wrong-reason'), '');
  await expect(observe({ ...enabled })).rejects.toMatchObject({ grade: { exit: 2 } });
  expect(readFileSync(nodePath.join(owned, 'observations.jsonl'), 'utf8')).toContain(
    'design-mismatch',
  );
  rmSync(nodePath.join(root, 'wrong-reason'));
  for (const [mode, exit] of [
    ['missing-effect', 2],
    ['missing-no-effect', 3],
    ['error-effect', 2],
    ['error-no-effect', 3],
  ] as const) {
    const ledger = nodePath.join(owned, 'observations.jsonl');
    const beforeLedger = readFileSync(ledger, 'utf8');
    writeFileSync(nodePath.join(root, 'design-bypass-mode'), mode);
    let failure: unknown;
    try {
      await observe({ ...enabled });
    } catch (error) {
      failure = error;
    }
    const first = settings.observations[0]?.observation;
    assert.ok(first);
    const target = JSON.parse(first.raw).observations[0].input.tool_input.file_path;
    expect(readFileSync(target, 'utf8')).toBe(
      mode.endsWith('no-effect') ? first.before : first.expectedEffect,
    );
    expect(nativePropagationExit(failure), `DESIGN_BYPASS_CAPTURE:${mode}`).toBe(exit);
    if (exit === 2) {
      const last = JSON.parse(readFileSync(ledger, 'utf8').trim().split('\n').at(-1) ?? '');
      expect(last.raw_artifact).toContain('-design-mismatch.stdout');
      const actual = JSON.parse(readFileSync(last.observation_artifact, 'utf8'));
      const raw = JSON.parse(readFileSync(last.raw_artifact, 'utf8'));
      expect(actual.effect).toBe(actual.expectedEffect);
      expect(actual.effect).not.toBe(actual.before);
      expect(actual).not.toHaveProperty('decision');
      expect(raw.observations).toEqual([]);
      expect(raw.events.some((row: { type: string }) => row.type === 'assistant')).toBe(true);
      expect(raw.effect).toBe(actual.effect);
      expect(JSON.parse(actual.configuration.bytes)).toMatchObject(enabled);
    } else expect(readFileSync(ledger, 'utf8')).toBe(beforeLedger);
    rmSync(nodePath.join(root, 'design-bypass-mode'));
  }
}
