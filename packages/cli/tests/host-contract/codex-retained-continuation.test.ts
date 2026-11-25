import { execFileSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

import type { RetainedPolicyActor } from '../../scripts/lib/resource-propagation.js';
import {
  captureNativePropagationActor,
  retainNativeResourceActor,
} from '../../scripts/lib/resource-propagation-run.js';
import { CodexNativeCatalogueActor } from '../helpers/codex-native-catalogue.js';
import { CodexNativeContinuationActor } from '../helpers/codex-native-continuation.js';

// Only the vendor process is substituted; the generated installed Stop guard runs.
it.each(['none', 'missing', 'foreign', 'excess', 'quiet'])(
  'captures the retained trial and refuses %s continuation faults',
  async fault => {
    const temporary = mkdtempSync(path.join(tmpdir(), 'codex-guard-'));
    const root = realpathSync(temporary);
    try {
      const profile = path.join(root, 'profile');
      const project = path.join(root, 'project');
      const installedPath = path.join(profile, 'plugins/cache/candidate');
      mkdirSync(project, { recursive: true });
      mkdirSync(path.join(project, '.safeword'));
      writeFileSync(path.join(project, '.safeword/SAFEWORD.md'), 'Synthetic retained project.\n');
      writeFileSync(path.join(project, '.safeword/config.json'), '{}');
      execFileSync('git', ['init', '--quiet'], { cwd: project });
      cpSync(path.resolve(import.meta.dirname, '../../codex-plugin'), installedPath, {
        recursive: true,
      });
      const binary = path.join(root, 'vendor');
      const script = path.join(root, 'vendor.mjs');
      writeFileSync(
        binary,
        `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(script)} "$@"\n`,
        { mode: 0o755 },
      );
      writeFileSync(
        script,
        `
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
if (process.argv.includes('--version')) { console.log('codex-cli 0.167.0'); process.exit(0); }
const plugin = ${JSON.stringify(installedPath)};
const prompt = process.argv.at(-1);
const marker = /Reply only (FINISH_[a-f0-9-]+)/.exec(prompt)?.[1];
const fault = marker ? ${JSON.stringify(fault)} : 'none';
console.log(JSON.stringify({type:'thread.started',thread_id:'retained-thread'}));
function stop(active, text) {
 const hook=JSON.parse(readFileSync(path.join(plugin,'hooks.json'),'utf8')).hooks.Stop[0].hooks[0].command;
 const result=spawnSync('sh',['-c',hook],{env:{...process.env,PLUGIN_ROOT:plugin,SAFEWORD_CLI:undefined},encoding:'utf8',input:JSON.stringify({cwd:process.cwd(),session_id:fault==='foreign'?'foreign-thread':'retained-thread',stop_hook_active:active,hook_event_name:'Stop',last_assistant_message:text})});
 if(result.status!==0)throw Error(result.stderr);
 return JSON.parse(result.stdout);
}
const first=marker ?? 'READY';
console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:first}}));
const decision=stop(fault==='quiet',first);
if(marker && decision.decision==='block' && fault!=='missing') {
 const text='The verification evidence is missing.';
 console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text}}));
 stop(true,text);
 if(fault==='excess')stop(true,text);
}
console.log(JSON.stringify({type:'turn.completed'}));
`,
      );
      const fixture = { root, profile, project, installedPath, binary };
      const source = path.resolve(import.meta.dirname, '../../codex-plugin');
      const actor = new CodexNativeContinuationActor(fixture, source);
      const catalogue = retainNativeResourceActor(
        new CodexNativeCatalogueActor(fixture, undefined, 'provisioned', source),
      );
      await expect(catalogue.observeContinuation?.()).rejects.toThrow(
        'retained Codex thread missing',
      );
      expect(() => {
        catalogue.assertContinuation?.();
      }).toThrow('retained Codex thread missing');
      await actor.prepareContinuation('Codex', '0.167.0');
      const earlier = await actor.observeVerification(
        '**PR Scope:** ✅ Synthetic fixture matches its scope\n',
      );
      expect(earlier.installation).toBe(JSON.stringify([installedPath, project]));
      expect(JSON.parse(earlier.raw).observations.length).toBeGreaterThan(0);
      const retained = captureNativePropagationActor(
        {
          observeContinuation: () => actor.observeRetainedContinuation(),
          assertContinuation: () => {
            actor.assertContinuation();
          },
        } as unknown as RetainedPolicyActor,
        'codex',
        root,
      );
      const capture: unknown = Reflect.get(retained, 'observeContinuation');
      expect(capture, 'CODEX_RETAINED_CAPTURE_MISSING').toBeTypeOf('function');
      if (typeof capture !== 'function') throw new Error('capture missing');
      const observed = await capture();
      expect(observed.installation).toBe(earlier.installation);
      const records = readFileSync(path.join(root, 'observations.jsonl'), 'utf8');
      expect(records).toContain('"kind":"continuation"');
      const raw = JSON.parse(observed.raw);
      const lengths: Record<string, number> = {
        none: 2,
        missing: 1,
        excess: 3,
        foreign: 1,
        quiet: 1,
      };
      const failures: Record<string, string> = {
        missing: 'HOST_CONTINUATION_MISSING',
        excess: 'CONTINUATION_BOUND_EXCEEDED',
        foreign: 'foreign-thread',
        quiet: 'HOST_CONTRACT_PROOF_UNAVAILABLE: capacity consumed',
      };
      expect(raw.stops).toHaveLength(lengths[fault] ?? 0);
      if (fault !== 'none') {
        expect(() => {
          actor.assertContinuation();
        }).toThrow(failures[fault]);
        return;
      }
      expect(
        raw.stops.map((stop: { input: { session_id: string } }) => stop.input.session_id),
      ).toEqual(['retained-thread', 'retained-thread']);
      actor.assertContinuation();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
  120_000,
);
