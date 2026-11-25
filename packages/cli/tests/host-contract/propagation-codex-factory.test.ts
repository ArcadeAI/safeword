import {
  existsSync,
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

import { expect, it, vi } from 'vitest';

import { propagationLanes } from '../../scripts/lib/resource-propagation.js';
import {
  prepareNativeResourceActor,
  runNativeResourcePropagation,
} from '../../scripts/lib/resource-propagation-run.js';
import { createCanonicalCatalogueInputs } from '../helpers/native-catalogue-probe.js';

// Real runner factory, normal generators/install and helper; only the external
// Codex executable/RPC is substituted. No native trust or model proof.
it('retains the explicitly provisioned Codex fixture and one per-run source across revisions', async () => {
  const temporary = mkdtempSync(nodePath.join(tmpdir(), 'codex-guard-'));
  const root = realpathSync(temporary);
  try {
    const profile = nodePath.join(root, 'profile');
    const project = nodePath.join(root, 'project');
    const installedPath = nodePath.join(profile, 'plugins/cache/candidate');
    for (const p of [
      installedPath,
      project,
      nodePath.join(root, 'run'),
      nodePath.join(root, 'previous'),
      nodePath.join(root, 'current'),
    ])
      mkdirSync(p, { recursive: true });
    const auth = nodePath.join(profile, 'auth.json');
    writeFileSync(auth, '{"fixture_only":true}');
    const binary = nodePath.join(root, 'host');
    writeFileSync(
      binary,
      `#!/bin/sh\nexec "${process.execPath}" "${nodePath.join(root, 'host.mjs')}" "$@"\n`,
      { mode: 0o755 },
    );
    writeFileSync(
      nodePath.join(root, 'host.mjs'),
      String.raw`
import { appendFileSync, cpSync, existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root = ${JSON.stringify(root)};
const plugin = path.join(process.env.CODEX_HOME, 'plugins/cache/candidate');
appendFileSync(path.join(root, 'calls.jsonl'), JSON.stringify({profile: process.env.CODEX_HOME, cwd: process.cwd(), args: process.argv.slice(2)})+'\n');
if (process.argv.includes('--version')) { console.log('codex-cli 0.167.0'); process.exit(0); }
if (process.argv.includes('marketplace')) { console.log('{}'); process.exit(0); }
if (process.argv.includes('plugin') && process.argv.includes('add')) {
 const registryRoot = path.dirname(process.env.CODEX_HOME);
 const registry = JSON.parse(readFileSync(path.join(registryRoot, '.agents/plugins/marketplace.json'), 'utf8'));
 cpSync(path.resolve(registryRoot, registry.plugins[0].source.path), plugin, { recursive:true });
 console.log(JSON.stringify({installedPath:plugin})); process.exit(0);
}
if (process.argv.includes('app-server')) {
 const { createInterface } = await import('node:readline');
 for await (const line of createInterface({ input:process.stdin })) {
  const message=JSON.parse(line);
  if(message.id===1) console.log(JSON.stringify({id:1,result:{}}));
  if(message.id===2) console.log(JSON.stringify({id:2,result:{data:[{errors:[],warnings:[],hooks:
   ['sessionStart','userPromptSubmit','preToolUse','postToolUse','stop'].map(eventName=>({eventName,sourcePath:path.join(plugin,'hooks.json'),enabled:true,trustStatus:existsSync(path.join(root,'untrusted'))?'untrusted':'trusted'}))
  }]}}));
  if(message.id===2 && existsSync(path.join(root,'release-trust'))) {
   rmSync(path.join(root,'untrusted')); rmSync(path.join(root,'release-trust'));
  }
 }
 process.exit(0);
}
if (!process.argv.includes('exec')) throw Error('Unexpected vendor command');
appendFileSync(path.join(root,'model-calls'),'exec\n');
const runtime=path.join(plugin,'runtime/cli.js');
const executed=spawnSync('bun',[runtime,'project','runtime','audit-principle-trace'],{encoding:'utf8',env:process.env});
if(executed.status!==0) throw Error(executed.stderr);
const helper='bun "'+runtime+'" project runtime audit-principle-trace';
console.log(JSON.stringify({type:'item.completed',item:{type:'command_execution',command:"sh -c '"+helper+"'",aggregated_output:executed.stdout,exit_code:executed.status}}));
console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:readFileSync(path.join(plugin,'skills/explain/SKILL.md'),'utf8')+readFileSync(path.join(plugin,'skills/explain/references/HOST_CONTRACT_GUIDE.md'),'utf8')}}));
console.log(JSON.stringify({type:'turn.completed'}));
`,
    );
    const previous = createCanonicalCatalogueInputs(nodePath.join(root, 'previous'));
    const current = createCanonicalCatalogueInputs(nodePath.join(root, 'current'));
    const lane = propagationLanes().find(row => row.agent === 'codex');
    expect(lane).toBeDefined();
    if (!lane) throw new Error('CODEX_REQUIRED_LANE_MISSING');
    const actor = await prepareNativeResourceActor(
      lane,
      previous,
      { root, profile, project, installedPath, binary },
      nodePath.join(root, 'run'),
    );
    const calls = () =>
      readFileSync(nodePath.join(root, 'calls.jsonl'), 'utf8')
        .trim()
        .split('\n')
        .map(line => JSON.parse(line));
    expect(
      calls().every(row => row.profile === profile && row.cwd === project),
      'CODEX_FACTORY_REPLACED_PROVISIONED_BINDING',
    ).toBe(true);
    expect(readFileSync(auth, 'utf8')).toBe('{"fixture_only":true}');
    expect(readdirSync(root).filter(name => name.startsWith('codex-guard-'))).toEqual([]);
    writeFileSync(nodePath.join(root, 'untrusted'), '');
    await expect(actor.observe()).rejects.toThrow(
      'exact prepared fixture requires native hook trust',
    );
    expect(existsSync(nodePath.join(root, 'model-calls'))).toBe(false);
    rmSync(nodePath.join(root, 'untrusted'));
    const observed = await actor.observe();
    expect(observed.installation).toBe(JSON.stringify([installedPath, project]));
    expect(observed.markers).toEqual({
      workflowMarker: previous.workflowMarker,
      guideMarker: previous.guideMarker,
      helperMarker: previous.helperMarker,
    });
    await actor.refreshResources(current);
    const refreshed = await actor.observe();
    expect(refreshed.installation).toBe(observed.installation);
    expect(refreshed.markers).toEqual({
      workflowMarker: current.workflowMarker,
      guideMarker: current.guideMarker,
      helperMarker: current.helperMarker,
    });
    const sources = readdirSync(nodePath.join(root, 'run')).filter(name =>
      name.startsWith('codex-source-'),
    );
    expect(sources).toHaveLength(1);
    const [directory] = sources;
    if (!directory) throw new Error('CODEX_OWNED_SOURCE_MISSING');
    const source = nodePath.join(root, 'run', directory, 'source/packages/cli');
    expect(
      readFileSync(nodePath.join(source, 'templates/skills/explain/SKILL.md'), 'utf8'),
    ).toContain(current.workflowMarker);
    expect(existsSync(nodePath.join(root, 'source'))).toBe(false);
    expect(readFileSync(auth, 'utf8')).toBe('{"fixture_only":true}');
    expect(calls().every(row => row.profile === profile && row.cwd === project)).toBe(true);
    // Only the substituted vendor RPC changes its fixture response, never native trust.
    const waiting = await prepareNativeResourceActor(
      lane,
      current,
      { root, profile, project, installedPath, binary },
      nodePath.join(root, 'run'),
      Date.now() + 30_000,
    );
    writeFileSync(nodePath.join(root, 'untrusted'), '');
    writeFileSync(nodePath.join(root, 'release-trust'), '');
    const additions = () => calls().filter(row => row.args.includes('add')).length;
    const staged = additions();
    const trustedObservation = await waiting.observe();
    expect(trustedObservation.installation).toBe(observed.installation);
    expect(additions(), 'TRUST_WAIT_REGENERATED_STAGED_PACKAGE').toBe(staged);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 120_000);

it.each(['missing', 'extra'])(
  'rejects %s fixture-map lanes before preparing any host',
  async mode => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'propagation-map-'));
    try {
      const bindings = Object.fromEntries(
        propagationLanes().map(lane => [lane.id, '/must-not-be-opened.json']),
      );
      if (mode === 'missing') delete bindings['codex@0.167.0/CLI/native'];
      else bindings['unexpected@0/CLI/native'] = '/must-not-be-opened.json';
      const file = nodePath.join(root, 'bindings.json');
      writeFileSync(file, JSON.stringify(bindings));
      vi.stubEnv('SAFEWORD_PROPAGATION_FIXTURES', file);
      await expect(runNativeResourcePropagation()).rejects.toThrow(
        'fixture bindings differ from required population',
      );
    } finally {
      vi.unstubAllEnvs();
      rmSync(root, { recursive: true, force: true });
    }
  },
);
