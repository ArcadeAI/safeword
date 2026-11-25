import { spawnSync } from 'node:child_process';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

it('grades real shared portable steps from observed vendor records, never blanket assertion RED', () => {
  const result = spawnSync(
    'bun',
    [
      '--eval',
      `
    import { mkdtempSync, mkdirSync, cpSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
    import path from 'node:path'; import { tmpdir } from 'node:os';
    import { loadSupport } from '@cucumber/cucumber/api';
    import { nativeResult } from './scripts/run-host-contract-proof.ts';
    import { portableCases } from './tests/fixtures/host-contract/native-contract-cases.ts';
    const root=mkdtempSync(path.join(tmpdir(),'portable-shared-then-'));
    try {
      const mode=path.join(root,'mode'); process.env.PORTABLE_TEST_MODE=mode;
      const binary=host=>path.join(root,'fake-'+host);
      for(const host of ['codex','cursor']) { cpSync('./tests/fixtures/host-contract/portable-vendor.mjs',binary(host)); chmodSync(binary(host),0o755); }
      const auth=path.join(root,'fake-auth');mkdirSync(auth);writeFileSync(path.join(auth,'auth.json'),'{}');
      const fixture=path.join(root,'fixture.json');writeFileSync(fixture,JSON.stringify({binary:binary('codex'),authenticatedFixtureProfile:auth,runsDirectory:root}));
      const support=await loadSupport({sources:{paths:['../../features/consistent-host-contract.feature']},support:{importPaths:['../../steps/consistent-host-portable.steps.ts']}});
      const texts=['a portable Agent Plugins package and its host-specific enforcement extension are installed in "Codex" version "0.167.0" in "CLI"',"the host loads the package's skill and referenced resource",'their content resolves from the portable bundle without treating that loading result as enforcement proof'];
      const steps=texts.map(text=> { const matches=support.stepDefinitions.filter(def=>def.matchesStepName(text)); if(matches.length!==1)throw Error('shared step not uniquely bound');return matches[0]; });
      const outcomes=[];
      for(const host of ['Codex','Cursor']) {
        const world={parameters:{codexFixtureFile:fixture,cursorCli:binary('cursor'),portableRuntime:'CLI'}};
        const row=portableCases().find(row=>row.host===host&&row.runtime==='CLI');
        writeFileSync(mode,'root'); await steps[0].code.call(world,host,row.version,row.runtime);
        for(const state of host==='Codex'?['missing-observation','missing-model','rpc-error','overlay','root']:['foreign-helper','root']) {
          writeFileSync(mode,state);let error;let phase='when';
          try {await steps[1].code.call(world);phase='then';steps[2].code.call(world);}catch(value){error=value;}
          const statuses=['passed','passed','passed'];if(error){statuses[phase==='when'?1:2]='failed';if(phase==='when')statuses[2]='skipped';}
          const scenario={name:row.scenario,line:row.line,steps:statuses.map(status=>({result:{status,error_message:error?.message}}))};
          const grade=nativeResult(path.resolve('../..'),path.join(root,'report.json'),[scenario],error?1:0,{cases:[row],host:row.host,runtime:row.runtime});
          if(error) console.error(JSON.stringify({host,state,phase,error:error.message}));
          outcomes.push({host,state,grade});
        }
      }
      console.log(JSON.stringify(outcomes));
    } finally {rmSync(root,{recursive:true,force:true});}
  `,
    ],
    { cwd: nodePath.resolve(import.meta.dirname, '../..'), encoding: 'utf8', timeout: 120_000 },
  );
  expect(result.status, result.stderr + result.stdout).toBe(0);
  const actual = JSON.parse(result.stdout.trim().split('\n').at(-1) ?? 'null');
  expect(actual, `PORTABLE_OBSERVATION_FALSE_RED: ${result.stderr}`).toEqual([
    { host: 'Codex', state: 'missing-observation', grade: 3 },
    { host: 'Codex', state: 'missing-model', grade: 3 },
    { host: 'Codex', state: 'rpc-error', grade: 3 },
    { host: 'Codex', state: 'overlay', grade: 2 },
    { host: 'Codex', state: 'root', grade: 0 },
    { host: 'Cursor', state: 'foreign-helper', grade: 3 },
    { host: 'Cursor', state: 'root', grade: 0 },
  ]);
});
