import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
import hostReleases from '../../src/lifecycle/host-releases.json' with { type: 'json' };
import combinations from '../fixtures/host-contract/documented-option-composition.json';
import { CursorCliCatalogueActor } from '../helpers/cursor-cli-catalogue.js';
import { observedNativeWrite } from '../helpers/cursor-cli-observations.js';
import { createCanonicalCatalogueInputs } from '../helpers/native-catalogue-probe.js';
import { createPropagationSource } from '../helpers/propagation-source.js';

// Only the external vendor process is substituted; registered generated guards execute normally.
it('captures six CLI Write design configurations without a Stop observation', async () => {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'cursor-cli-design-'));
  let actor: CursorCliCatalogueActor | undefined;
  try {
    const binary = nodePath.join(root, 'vendor');
    writeFileSync(
      binary,
      `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(nodePath.join(root, 'vendor.mjs'))} "$@"\n`,
      { mode: 0o755 },
    );
    writeFileSync(
      nodePath.join(root, 'vendor.mjs'),
      `
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const args=process.argv.slice(2);
if (args[0]==='--version') {console.log(${JSON.stringify(hostReleases.cursorCli.version)});process.exit(0);}
const spec=JSON.parse(args.at(-1).split('DESIGN_WRITE_INPUT=')[1]);
const extension=args[args.lastIndexOf('--plugin-dir')+1];
const allowed=JSON.parse(readFileSync(path.join(process.cwd(),'.cursor/cli.json'),'utf8')).permissions.allow;
if(!allowed.includes('Write('+path.relative(process.cwd(),spec.file)+')')) throw Error('Exact owned Write permission missing');
const binding=JSON.parse(readFileSync(path.join(extension,'hooks/hooks.json'),'utf8')).hooks.preToolUse[0];
const session='source-session-'+Math.random();
const call_id='source-write-'+Math.random();
const tool={args:{path:spec.file,fileText:spec.content,toolCallId:call_id}};
console.log(JSON.stringify({type:'tool_call',subtype:'started',call_id,session_id:session,tool_call:{writeToolCall:tool}}));
const executed=spawnSync('sh',['-c',' . "$ZDOTDIR/.zprofile"; exec sh -c "$1"','source-cli',binding.command],{
  env:{...process.env,PATH:path.dirname(process.env.SAFEWORD_OBSERVER_REAL_BUN)+':'+process.env.PATH,CURSOR_PLUGIN_ROOT:extension},
  input:JSON.stringify({hook_event_name:'preToolUse',tool_name:'Write',conversation_id:session,workspace_roots:[process.cwd()],tool_input:{file_path:spec.file,content:spec.content}}),encoding:'utf8'});
if(executed.status!==0) throw Error(executed.stderr);
const decision=JSON.parse(executed.stdout);
if(decision.permission==='allow') writeFileSync(spec.file,spec.content);
// Qualified process substitute records only; not native enforcement evidence.
tool.result=decision.permission==='allow'?{success:{path:spec.file,fileSize:Buffer.byteLength(spec.content)}}:{rejected:{reason:decision.user_message}};
console.log(JSON.stringify({type:'tool_call',subtype:'completed',call_id,session_id:session,tool_call:{writeToolCall:tool}}));
if(!existsSync(${JSON.stringify(nodePath.join(root, 'no-terminal'))})) console.log(JSON.stringify({type:'result',subtype:'success',is_error:false,session_id:session}));
`,
    );
    const inputs = createCanonicalCatalogueInputs(root);
    actor = new CursorCliCatalogueActor(binary, {
      ...inputs,
      sourcePackage: createPropagationSource(root, inputs),
    });
    await actor.prepare('Cursor', hostReleases.cursorCli.version, 'CLI');
    const retained = retainNativeResourceActor(actor);
    const captured = captureNativePropagationActor(retained, 'cli-design', root);
    const result = await runDesignApprovalSettings(captured);
    expect(result.exit, result.failures.join('\n')).toBe(0);
    expect(result.observations).toHaveLength(6);
    for (const [index, row] of result.observations.entries()) {
      expect(row.protocol).toBe('permission-json');
      expect(JSON.parse(row.observation.configuration.bytes)).toMatchObject(
        combinations[index] ?? {},
      );
      expect(row.observation.installation).toBe(actor.observedInstallation());
      expect(row.observation.raw).toContain('writeToolCall');
      expect(row.observation.raw).not.toContain('stop:0');
      expect(row.observation.effect).toBe(
        combinations[index]?.designApprovalGate
          ? row.observation.before
          : row.observation.expectedEffect,
      );
    }
    await assertCapturedFaults(result.observations, retained, root);
    const first = result.observations[0];
    assert.ok(first);
    const { events: raw } = JSON.parse(first.observation.raw) as { events: string };
    assertWriteFaults(raw, actor.observedInstallation());
    writeFileSync(nodePath.join(root, 'no-terminal'), '');
    const options = combinations[0];
    assert.ok(options);
    await expect(captured.observeDesignApproval?.(options)).rejects.toThrow(
      'Cursor CLI turn incomplete',
    );
  } finally {
    actor?.close();
    rmSync(root, { recursive: true, force: true });
  }
}, 120_000);

// Grader-only projection doubles, not native/vendor evidence or guard output injection.
async function assertCapturedFaults(
  rows: DesignSettingObservation[],
  retained: RetainedPolicyActor,
  root: string,
) {
  type Facts = Extract<DesignSettingObservation, { protocol: 'permission-json' }>['observation'];
  const cases: { name: string; index: number; exit: number; alter: (o: Facts) => Facts }[] = [
    {
      name: 'after',
      index: 1,
      exit: 2,
      alter: o => ({
        ...o,
        configuration: { ...o.configuration, after: `${o.configuration.after}\n` },
      }),
    },
    {
      name: 'enabled-allow',
      index: 1,
      exit: 2,
      alter: o => ({ ...o, decision: { ...o.decision, permission: 'allow' } }),
    },
    {
      name: 'disabled-deny',
      index: 0,
      exit: 2,
      alter: o => ({ ...o, decision: { ...o.decision, permission: 'deny' } }),
    },
    {
      name: 'reason',
      index: 1,
      exit: 2,
      alter: o => ({
        ...o,
        decision: { permission: 'deny', user_message: 'unrelated', agent_message: 'unrelated' },
      }),
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
    {
      name: 'dropped-option',
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
        },
      }),
    },
  ];
  const oracle = JSON.stringify(combinations),
    originals = JSON.stringify(rows);
  for (const { name, index, exit, alter } of cases) {
    const actual = rows[index];
    assert.ok(actual?.protocol === 'permission-json');
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
      .map(line => JSON.parse(line) as { lane: string; observation_artifact: string })
      .filter(row => row.lane === name)[index];
    assert.ok(entry);
    expect(JSON.parse(readFileSync(entry.observation_artifact, 'utf8'))).toEqual(changed);
    expect(JSON.stringify(combinations)).toBe(oracle);
    expect(JSON.stringify(rows)).toBe(originals);
  }
}

function assertWriteFaults(raw: string, installation: string) {
  const decoded = raw
    .trim()
    .split('\n')
    .map(line => JSON.parse(line));
  const workspace = JSON.parse(installation)[1] as string;
  const request = decoded[0].tool_call.writeToolCall.args;
  const check = (events: typeof decoded) =>
    observedNativeWrite(
      events.map(row => JSON.stringify(row)).join('\n'),
      workspace,
      request.path,
      request.fileText,
      decoded[0].session_id,
    );
  const faults: Record<string, (events: typeof decoded) => void> = {
    missingComplete: events => {
      events.splice(1, 1);
    },
    foreignSession: events => {
      events[1].session_id = 'foreign';
    },
    callId: events => {
      events[1].call_id = 'different';
    },
    path: events => {
      events[0].tool_call.writeToolCall.args.path = '/foreign';
    },
    content: events => {
      events[0].tool_call.writeToolCall.args.fileText = 'unrelated';
    },
    emptyResult: events => {
      events[1].tool_call.writeToolCall.result = {};
    },
  };
  for (const alter of Object.values(faults)) {
    const events = structuredClone(decoded);
    alter(events);
    expect(() => check(events)).toThrow();
  }
}
