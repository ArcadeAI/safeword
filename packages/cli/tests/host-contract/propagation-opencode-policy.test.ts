import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

import { runDesignApprovalSettings } from '../../scripts/lib/propagation-settings.js';
import {
  propagationLanes,
  type RetainedPolicyActor,
} from '../../scripts/lib/resource-propagation.js';
import {
  captureNativePropagationActor,
  prepareNativeResourceActor,
} from '../../scripts/lib/resource-propagation-run.js';
import combinations from '../fixtures/host-contract/documented-option-composition.json';
import { createCanonicalCatalogueInputs } from '../helpers/native-catalogue-probe.js';
import { OpenCodeNativeCatalogueActor } from '../helpers/opencode-native-catalogue.js';
import {
  createPropagationSource,
  requirePropagationVerificationMarker,
} from '../helpers/propagation-source.js';

// External vendor process substituted, not its installed SDK callback/dispatcher
// or the loopback model transport. Fixture inventory is NOT native authority.
it('observes installed verification decisions across the retained SDK candidate and refuses omitted dispatch', async () => {
  const temporary = mkdtempSync(nodePath.join(tmpdir(), 'opencode-retained-policy-'));
  const root = realpathSync(temporary);
  try {
    const inputs = createCanonicalCatalogueInputs(root);
    const sourcePackage = createPropagationSource(root, inputs);
    const current = { ...inputs, sourcePackage };
    symlinkSync(
      nodePath.resolve(import.meta.dirname, '../../../opencode-v2-plugin/node_modules'),
      nodePath.join(root, 'node_modules'),
    );
    const binary = nodePath.join(root, 'external-host');
    const bun = realpathSync(execFileSync('which', ['bun'], { encoding: 'utf8' }).trim());
    writeFileSync(
      binary,
      `#!/bin/sh\nif [ "$1" = --version ]; then echo 'opencode v2.4.1'; exit; fi\nexec ${JSON.stringify(bun)} ${JSON.stringify(nodePath.join(root, 'host.mjs'))} "$@"\n`,
      { mode: 0o755 },
    );
    writeFileSync(
      nodePath.join(root, 'host.mjs'),
      String.raw`
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
// The TUI driver closes a completed vendor process with Ctrl-C.
process.on('SIGINT',()=>process.exit(0));
const root=path.dirname(process.cwd());
appendFileSync(path.join(root,'source-vendor-argv.jsonl'),JSON.stringify(process.argv.slice(2))+'\n');
const declarations=JSON.parse(readFileSync(path.join(process.env.OPENCODE_CONFIG_DIR,'opencode.jsonc'),'utf8')).plugins;
const before=[], prompt=[];
const inventory=[];
for (const declaration of declarations) {
 const directory=typeof declaration==='string'?declaration:declaration.package;
 const plugin=(await import(pathToFileURL(path.join(directory,'index.'+(typeof declaration==='string'?'ts':'js'))).href)).default;
 const ctx={options:declaration.options??{},location:{directory:process.cwd()},app:{version:'2.4.1'},
  tool:{hook:async(event,fn)=>{if(event==='execute.before')before.push({fn,candidate:typeof declaration!=='string'});}},
  session:{get:async()=>({id:'source-session'}),hook:async(event,fn)=>{if(event==='prompt')prompt.push(fn);}},
  skill:{transform:async()=>({dispose:async()=>{}})},command:{transform:async()=>{}},
  plugin:{list:async()=>({data:inventory})}};
 await plugin.setup(ctx);
 inventory.push({source:{type:'local',path:path.join(directory,'index.'+(typeof declaration==='string'?'ts':'js'))},state:{status:'active'}});
}
for(const fn of prompt)await fn({sessionID:'source-session',prompt:{text:'Synthetic source boundary'}});
const model=JSON.parse(readFileSync('opencode.json','utf8')).provider.fixture.options.baseURL;
const messages=[];
async function request(){
 const response=await fetch(model+'/chat/completions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({stream:true,tools:['shell','write','edit'].map(name=>({function:{name}})),messages})});
 const body=await response.text();
 return body.split('\n').filter(line=>line.startsWith('data: {')).map(line=>JSON.parse(line.slice(6))).flatMap(row=>row.choices[0].delta.tool_calls??[])[0];
}
const call=await request();
if(!call)throw Error('No scripted native-shaped call');
const input=JSON.parse(call.function.arguments);
const tool=call.function.name;
if(existsSync(${JSON.stringify(nodePath.join(root, 'wrong-path'))})) { input.file_path=input.path; delete input.path; }
if(existsSync(${JSON.stringify(nodePath.join(root, 'wrong-reason'))})) {
 const plan=path.join(process.cwd(),'.project/tickets/PRP123-propagation/impl-plan.md');
 writeFileSync(plan,readFileSync(plan,'utf8').replace('**Status:** planned','**Status:** implemented'));
}
let result;
try {
 for(const hook of before)if(!(hook.candidate&&(existsSync(${JSON.stringify(nodePath.join(root, 'omit'))}) || existsSync(${JSON.stringify(nodePath.join(root, 'design-bypass'))}))))await hook.fn({tool,input,sessionID:'source-session'});
 if(tool==='shell') {
  const child=spawnSync('sh',['-c',input.command],{encoding:'utf8'});
  if(child.status!==0)throw Error(child.stderr);
  result=child.stdout;
 } else {
  const content=tool==='write'?input.content:readFileSync(input.path,'utf8').replace(input.oldString,input.newString);
  if(!existsSync(${JSON.stringify(nodePath.join(root, 'design-no-effect'))}))writeFileSync(input.path,content); result='Local phase write completed';
 }
} catch(error){result=error.message;}
messages.push({role:'tool',content:result});
await request();
console.log('SAFEWORD_NATIVE_TURN_COMPLETE');
`,
    );
    await characterizeFactory(root, binary);
    const actor = new OpenCodeNativeCatalogueActor(
      { runsDirectory: root, v2Binary: binary },
      'skill',
      current,
    );
    await actor.prepare('OpenCode V2', '2.4.1', 'CLI');
    const scope = '**PR Scope:** ✅ Synthetic fixture matches its scope\n';
    const baseline = await actor.observeVerification(scope, scope);
    expect(baseline.observations[0].status).toBe(0);
    expect(baseline.effect).toBe(baseline.expectedEffect);
    const option = await actor.observeVerification(scope, scope, { enabled: false, tool: 'write' });
    const optionProject = JSON.parse(option.installation)[1];
    const optionTicket = nodePath.join(
      optionProject,
      '.project/tickets/PRP123-propagation/ticket.md',
    );
    expect(readFileSync(optionTicket, 'utf8'), 'OPENCODE_DESIGN_APPROVAL_CASE_DROPPED').toContain(
      'phase: plan-execution',
    );
    const configuredOptions = combinations[1];
    assert.ok(configuredOptions);
    const configured = await actor.observeVerification(scope, scope, {
      enabled: true,
      tool: 'write',
      configuration: { ...configuredOptions },
    });
    const configBytes = readFileSync(
      nodePath.join(JSON.parse(configured.installation)[1], '.safeword/config.json'),
      'utf8',
    );
    for (const [key, value] of Object.entries(configuredOptions))
      expect(JSON.parse(configBytes)[key], `OPENCODE_DESIGN_OPTION_DROPPED:${key}`).toBe(value);
    for (const tool of ['write', 'edit'] as const) {
      const deniedOption = await actor.observeVerification(scope, scope, { enabled: true, tool });
      expect(deniedOption.installation).toBe(baseline.installation);
      expect(deniedOption.effect).toContain('phase: plan-implementation');
      expect(deniedOption.observations[0].status).toBe(2);
      expect(deniedOption.observations[0].stderr).toMatch(/design approval.*approve-plan/isu);
      const repairedOption = await actor.observeVerification(scope, scope, {
        enabled: false,
        tool,
      });
      expect(repairedOption.installation).toBe(deniedOption.installation);
      expect(repairedOption.effect).toBe(repairedOption.expectedEffect);
      expect(repairedOption.observations[0].input.tool_name).toBe(
        tool === 'write' ? 'Write' : 'Edit',
      );
      expect(JSON.parse(repairedOption.raw).results).toContainEqual({
        role: 'tool',
        content: 'Local phase write completed',
      });
    }
    writeFileSync(nodePath.join(root, 'wrong-reason'), '');
    await expect(
      actor.observeVerification(scope, scope, { enabled: true, tool: 'write' }),
    ).rejects.toThrow('OPENCODE_DESIGN_APPROVAL_REASON_MISMATCH');
    rmSync(nodePath.join(root, 'wrong-reason'));
    writeFileSync(nodePath.join(root, 'wrong-path'), '');
    await expect(
      actor.observeVerification(scope, scope, { enabled: true, tool: 'write' }),
    ).rejects.toThrow('native verification guard missing');
    rmSync(nodePath.join(root, 'wrong-path'));
    writeFileSync(nodePath.join(root, 'omit'), '');
    await expect(
      actor.observeVerification(scope, scope, { enabled: true, tool: 'write' }),
    ).rejects.toThrow('native verification guard missing');
    rmSync(nodePath.join(root, 'omit'));
    const marker = 'VERIFICATION_ef-ab';
    requirePropagationVerificationMarker(inputs, marker);
    await actor.refreshResources(current);
    const denied = await actor.observeVerification(scope, `${scope}${marker}\n`);
    expect(denied.installation).toBe(baseline.installation);
    expect(denied.observations[0].status).toBe(2);
    expect(denied.observations[0].stderr).toContain('invalid verification evidence');
    expect(denied.effect).toBeUndefined();
    const allowed = await actor.observeVerification(`${scope}${marker}\n`, `${scope}${marker}\n`);
    expect(allowed.installation).toBe(baseline.installation);
    expect(allowed.observations[0].status).toBe(0);
    expect(allowed.effect).toBe(allowed.expectedEffect);
    writeFileSync(nodePath.join(root, 'omit'), '');
    await expect(
      actor.observeVerification(`${scope}${marker}\n`, `${scope}${marker}\n`),
    ).rejects.toThrow('native verification guard missing');
    const directory = readdirSync(root).find(name => name.startsWith('opencode-native-'));
    expect(directory).toBeDefined();
    expect(
      readFileSync(nodePath.join(root, directory ?? '', 'native-observations.jsonl'), 'utf8'),
    ).toContain('source-session');
    expect(
      readFileSync(nodePath.join(root, directory ?? '', 'runtime-observations.jsonl'), 'utf8'),
    ).toBe('');
  } catch (error) {
    for (const directory of readdirSync(root)) {
      if (!directory.startsWith('opencode-native-')) continue;
      const file = nodePath.join(root, directory, 'native-stderr.log');
      if (existsSync(file)) console.error(readFileSync(file, 'utf8'));
    }
    throw error;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 120_000);

async function characterizeFactory(root: string, binary: string) {
  // New factory characterization; old assertions below stay unchanged.
  const lanes = propagationLanes().filter(row => row.agent === 'opencode');
  for (const lane of lanes) {
    const owned = mkdtempSync(nodePath.join(root, 'factory-'));
    const revision = createCanonicalCatalogueInputs(owned);
    const prepared = await prepareNativeResourceActor(
      lane,
      revision,
      { runsDirectory: owned, v2Binary: binary },
      owned,
    );
    const retained = prepared as Partial<RetainedPolicyActor>;
    expect(() => prepared.fingerprint()).toThrow('installed OpenCode candidate missing');
    expect(typeof retained.observeVerification, 'PROPAGATION_POLICY_FACTORY_BINDING_MISSING').toBe(
      'function',
    );
    if (!retained.observeVerification)
      throw new Error('PROPAGATION_POLICY_FACTORY_BINDING_MISSING');
    const evidence = '**PR Scope:** ✅ Synthetic fixture matches its scope\n';
    const baseline = await retained.observeVerification(evidence, evidence);
    expect(baseline.protocol).toBe('exit-status');
    const vendorCalls = readFileSync(
      nodePath.join(
        JSON.parse(baseline.observation.installation)[1],
        '../source-vendor-argv.jsonl',
      ),
      'utf8',
    )
      .trim()
      .split('\n')
      .map(line => JSON.parse(line) as string[]);
    expect(vendorCalls.every(args => args.includes('run') === (lane.runtime === 'CLI'))).toBe(true);
    assert.ok(baseline.protocol === 'exit-status');
    expect(baseline.observation.observations[0]?.status).toBe(0);
    expect(baseline.observation.effect).toBe(baseline.observation.expectedEffect);
    await characterizeDesign(prepared, lane.id, root, owned, baseline.observation.installation);
    const baselineBytes = prepared.fingerprint();
    expect(baselineBytes.resources).toHaveLength(3);
    const packageRoot = JSON.parse(baseline.observation.installation)[0] as string;
    const runtimeFile = nodePath.join(packageRoot, 'runtime/cli.js');
    const runtimeBefore = readFileSync(runtimeFile, 'utf8');
    const resourceFiles = [
      'skills/explain/SKILL.md',
      'skills/explain/references/HOST_CONTRACT_GUIDE.md',
      'templates/hooks/audit-principle-trace.ts',
    ];
    const resourcesBefore = resourceFiles.map(file =>
      readFileSync(nodePath.join(packageRoot, file)),
    );
    requirePropagationVerificationMarker(revision, 'VERIFICATION_ab-cd');
    await prepared.refreshResources(revision);
    expect(prepared.fingerprint().policy).not.toBe(baselineBytes.policy);
    expect(readFileSync(runtimeFile, 'utf8'), 'PROPAGATION_FACTORY_RUNTIME_STALE').not.toBe(
      runtimeBefore,
    );
    expect(readFileSync(runtimeFile, 'utf8')).toContain('VERIFICATION_ab-cd');
    expect(
      readFileSync(nodePath.join(packageRoot, 'templates/hooks/lib/done-gate.ts'), 'utf8'),
    ).toContain('VERIFICATION_ab-cd');
    expect(resourceFiles.map(file => readFileSync(nodePath.join(packageRoot, file)))).toEqual(
      resourcesBefore,
    );
    const valid = `${evidence}\nVERIFICATION_ab-cd\n`;
    const denied = await retained.observeVerification(evidence, valid);
    expect(denied.protocol).toBe('exit-status');
    assert.ok(denied.protocol === 'exit-status');
    expect(denied.observation.observations[0]?.status).toBe(2);
    expect(denied.observation.observations[0]?.stderr).toContain('invalid verification evidence');
    expect(denied.observation.effect).toBeUndefined();
    const repaired = await retained.observeVerification(valid, valid);
    expect(repaired.protocol).toBe('exit-status');
    assert.ok(repaired.protocol === 'exit-status');
    expect(repaired.observation.effect).toBe(repaired.observation.expectedEffect);
    expect(repaired.observation.installation).toBe(baseline.observation.installation);
  }
}

async function characterizeDesign(
  prepared: RetainedPolicyActor,
  lane: string,
  root: string,
  owned: string,
  installation: string,
) {
  const configuredOptions = combinations[1];
  assert.ok(configuredOptions);
  const captured = captureNativePropagationActor(prepared, lane, owned);
  const design = await runDesignApprovalSettings(captured);
  expect(design.exit).toBe(0);
  expect(design.observations).toHaveLength(6);
  for (const [index, actual] of design.observations.entries()) {
    assert.ok(actual.protocol === 'exit-status');
    expect(actual.observation.installation).toBe(installation);
    const expected = combinations[index];
    assert.ok(expected);
    const config = JSON.parse(actual.observation.configuration.bytes);
    for (const [key, value] of Object.entries(expected)) expect(config[key]).toBe(value);
    expect(JSON.parse(actual.observation.raw).configurationAfter).toBe(
      actual.observation.configuration.bytes,
    );
    expect(actual.observation.observations[0]?.status).toBe(expected.designApprovalGate ? 2 : 0);
  }
  const persisted = readFileSync(nodePath.join(owned, 'observations.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map(line => JSON.parse(line));
  expect(persisted).toHaveLength(6);
  for (const [index, record] of persisted.entries())
    expect(JSON.parse(readFileSync(record.observation_artifact, 'utf8'))).toEqual(
      design.observations[index]?.observation,
    );
  await characterizeDesignBypass(captured, root, owned, configuredOptions);
}

async function characterizeDesignBypass(
  captured: RetainedPolicyActor,
  root: string,
  owned: string,
  configuredOptions: NonNullable<(typeof combinations)[1]>,
) {
  for (const noEffect of [false, true]) {
    writeFileSync(nodePath.join(root, 'design-bypass'), '');
    if (noEffect) writeFileSync(nodePath.join(root, 'design-no-effect'), '');
    const attempt = captured.observeDesignApproval?.({ ...configuredOptions });
    if (noEffect) await expect(attempt).rejects.toThrow('native verification guard missing');
    else {
      await expect(attempt).rejects.toMatchObject({ grade: { exit: 2 } });
      const rows = readFileSync(nodePath.join(owned, 'observations.jsonl'), 'utf8')
        .trim()
        .split('\n');
      const last = rows.at(-1);
      assert.ok(last);
      const record = JSON.parse(last);
      expect(record.kind).toBe('design-mismatch');
      const observed = JSON.parse(readFileSync(record.observation_artifact, 'utf8'));
      expect(observed.effect).toBe(observed.expectedEffect);
      expect(observed.observations).toEqual([]);
      expect(JSON.parse(observed.raw).native).toContain('source-session');
    }
    rmSync(nodePath.join(root, 'design-bypass'));
    rmSync(nodePath.join(root, 'design-no-effect'), { force: true });
  }
}
