import { spawnSync } from 'node:child_process';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

it('binds the actual Codex Given to its separate frozen prepared catalogue package', () => {
  const result = spawnSync(
    'bun',
    [
      '--eval',
      String.raw`
    import assert from 'node:assert/strict';
    import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, rmSync, readdirSync, realpathSync } from 'node:fs';
    import path from 'node:path'; import { tmpdir } from 'node:os';
    import { loadConfiguration, loadSupport } from '@cucumber/cucumber/api';
    import { CodexNativeCatalogueActor } from './tests/helpers/codex-native-catalogue.ts';
    import { createCanonicalCatalogueInputs } from './tests/helpers/native-catalogue-probe.ts';
    import { createPropagationSource } from './tests/helpers/propagation-source.ts';
    const root=realpathSync(mkdtempSync(path.join(tmpdir(),'codex-guard-')));
    try {
      const profile=path.join(root,'profile'), project=path.join(root,'project');
      const installedPath=path.join(profile,'plugins/cache/candidate'), binary=path.join(root,'vendor');
      for(const p of [installedPath,project])mkdirSync(p,{recursive:true});
      writeFileSync(path.join(profile,'auth.json'),'FAKE_SOURCE_FIXTURE_AUTH');
      writeFileSync(binary,'#!/bin/sh\nexec "'+process.execPath+'" "'+path.join(root,'vendor.mjs')+'" "$@"\n',{mode:0o755});
      writeFileSync(path.join(root,'vendor.mjs'),
        "import {appendFileSync,cpSync,readFileSync} from 'node:fs';import path from 'node:path';\n"+
        "const root=path.dirname(process.env.CODEX_HOME);appendFileSync(path.join(root,'calls'),JSON.stringify(process.argv.slice(2))+'\\n');\n"+
        "if(process.argv.includes('--version'))console.log('codex-cli 0.167.0');\n"+
        "else if(process.argv.includes('plugin')&&process.argv.includes('add')){const r=JSON.parse(readFileSync(path.join(root,'.agents/plugins/marketplace.json')));const installedPath=path.join(process.env.CODEX_HOME,'plugins/cache/candidate');cpSync(path.resolve(root,r.plugins[0].source.path),installedPath,{recursive:true});console.log(JSON.stringify({installedPath}));}\n"+
        "else if(process.argv.includes('exec')||process.argv.includes('app-server'))throw Error('SOURCE_MODEL_OR_TRUST_BOUNDARY_REACHED');else console.log('{}');\n");
      const fixture={root,profile,project,installedPath,binary};
      const inputs=createCanonicalCatalogueInputs(root);inputs.sourcePackage=createPropagationSource(root,inputs);
      const initial=new CodexNativeCatalogueActor(fixture,inputs,'provisioned');
      await initial.prepare('Codex','0.167.0','CLI');
      const expectedPackageRoot=path.join(root,'frozen-package');cpSync(installedPath,expectedPackageRoot,{recursive:true});
      const descriptor=path.join(root,'catalogue.json');writeFileSync(descriptor,JSON.stringify({fixture,inputs,expectedPackageRoot}));
      process.env.SAFEWORD_CODEX_CATALOGUE_FIXTURE=descriptor;
      process.env.SAFEWORD_CODEX_GUARD_FIXTURE='/unexecuted/separate-guard.json';
      process.env.SAFEWORD_CODEX_TEST_CONFIG='/unexecuted/separate-portable.json';
      const repo=path.resolve('../..');
      const {useConfiguration}=await loadConfiguration({file:'packages/cli/tests/fixtures/host-contract/cucumber.native-codex.mjs'},{cwd:repo});
      assert.equal(useConfiguration.worldParameters.codexCatalogueFixtureFile,descriptor,'PREPARED_CATALOGUE_BINDING_DROPPED');
      assert.equal(useConfiguration.worldParameters.codexGuardFixtureFile,'/unexecuted/separate-guard.json');
      assert.equal(useConfiguration.worldParameters.codexFixtureFile,'/unexecuted/separate-portable.json');
      const support=await loadSupport({sources:{paths:['../../features/consistent-host-contract.feature']},support:{importPaths:['../../steps/consistent-host-contract.steps.ts']}});
      const text='an isolated profile for "Codex" version "0.167.0" in "CLI" has the Safeword native plugin installed';
      const matches=support.stepDefinitions.filter(d=>d.matchesStepName(text));assert.equal(matches.length,1);
      const prepare=async parameters=>{const world={parameters};await matches[0].code.call(world,'Codex','0.167.0','CLI');return world.nativeCatalogue;};
      await assert.rejects(()=>prepare({codexGuardFixtureFile:descriptor}),/prepared catalogue descriptor required/);
      const actor=await prepare(useConfiguration.worldParameters);actor.confirmCanonicalProbe();
      assert.deepEqual(actor.preparedFixture(),fixture);
      assert.equal(readFileSync(path.join(profile,'auth.json'),'utf8'),'FAKE_SOURCE_FIXTURE_AUTH');
      assert.equal(readdirSync(root).some(n=>n.startsWith('codex-guard-')),false);
      const snapshot=path.join(expectedPackageRoot,'runtime/cli.js'), original=readFileSync(snapshot);
      const installs=()=>[...readFileSync(path.join(root,'calls'),'utf8').matchAll(/"plugin","add"/g)].length;
      const beforeMismatch=installs();
      writeFileSync(snapshot,Buffer.concat([original,Buffer.from('\nchanged expected snapshot')]));
      await assert.rejects(()=>prepare(useConfiguration.worldParameters),/prepared catalogue package changed/);
      assert.equal(installs(),beforeMismatch,'MISMATCHED_CATALOGUE_INSTALLED_BEFORE_REFUSAL');
      assert.deepEqual(readFileSync(path.join(installedPath,'runtime/cli.js')),original);
      writeFileSync(snapshot,original);
      const repaired=await prepare(useConfiguration.worldParameters);repaired.confirmCanonicalProbe();
      writeFileSync(path.join(installedPath,'runtime/cli.js'),'changed after Given');
      await assert.rejects(()=>repaired.invokeWorkflow(),/prepared catalogue package changed/);
      assert.ok(!readFileSync(path.join(root,'calls'),'utf8').includes('app-server'));
      assert.ok(!readFileSync(path.join(root,'calls'),'utf8').includes('"exec"'));
      console.log('PREPARED_CATALOGUE_CONTROLS_PASS');
    } finally {rmSync(root,{recursive:true,force:true});}
  `,
    ],
    { cwd: nodePath.resolve(import.meta.dirname, '../..'), encoding: 'utf8', timeout: 120_000 },
  );
  expect(result.status, result.stderr + result.stdout).toBe(0);
  expect(result.stdout).toContain('PREPARED_CATALOGUE_CONTROLS_PASS');
});
