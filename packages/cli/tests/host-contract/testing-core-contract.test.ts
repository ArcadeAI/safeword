import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { planningAuthorCopies } from '../../scripts/lib/planning-author-copies.js';
import { extractQualityReviewRubric } from '../../scripts/lib/quality-rubric.js';
import { PLANNING_AUTHOR_COPIES } from '../../src/planning/contracts.generated.js';
import { QUALITY_REVIEW_RUBRIC } from '../../src/review/quality-rubric.generated.js';
import {
  reviewerPromptInstructions,
  reviewPromptContract,
} from '../../src/review/review-rubric.js';
import { TESTING_CORE_LAYOUT } from '../../src/schema-layouts.js';
import {
  assertTestingCore,
  testingCoreBlock,
  withTestingCore,
} from '../../src/testing/shared-core.js';

const packageRoot = nodePath.resolve(import.meta.dirname, '../..');
const launcher = nodePath.resolve(packageRoot, '../../scripts/dev');
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
const block = testingCoreBlock();
const start = '<!-- SAFEWORD:TESTING_CORE_START -->';
const end = '<!-- SAFEWORD:TESTING_CORE_END -->';

it.each([
  ['missing', '# Testing\n'],
  ['stale', block.replace('State the test-scope', 'Old test-scope')],
  ['duplicate', block + block],
  ['reversed', `${end}\n${start}`],
  ['unclosed', start],
])('rejects %s essential content without accepting its digest alone', (_label, content) => {
  expect(() => {
    assertTestingCore(content, 'skills/testing/SKILL.md');
  }).toThrow();
});

it('preserves frontmatter and optional references while rejecting a second consumer owner', () => {
  const source = '---\nname: testing\n---\n\n# Testing\n\nOptional: [examples](examples.md).\n';
  const rendered = withTestingCore(source);
  expect(rendered.startsWith('---\nname: testing\n---')).toBe(true);
  expect(rendered).toContain('Optional: [examples](examples.md).');
  expect(withTestingCore(rendered)).toBe(rendered);
  expect(Buffer.byteLength(block)).toBeLessThanOrEqual(2048);
  expect(() => {
    assertTestingCore(block, 'skills/explain/SKILL.md');
  }).toThrow('Unexpected');
  expect(() => withTestingCore(block + block)).toThrow('one ordered pair');
});

it('composes the actual quality prompt without changing severity or planning author identity', () => {
  expect(reviewerPromptInstructions('quality-review', 'claude')).toContain(block);
  const quality = readFileSync(
    nodePath.join(packageRoot, 'templates/skills/quality-review/SKILL.md'),
    'utf8',
  );
  expect(extractQualityReviewRubric(quality)).toBe(QUALITY_REVIEW_RUBRIC);
  expect(planningAuthorCopies(packageRoot, 'templates')).toEqual(PLANNING_AUTHOR_COPIES);
});

// Captured from the unchanged non-quality prompt functions at 931cc95d6;
// the source diff changes only the quality focus/composition, not these paths.
it.each([
  ['scenario-gate', '3f6db75273de2eafecb96366b20ca85081fbf2a2896274f9282eef6a224a11fe'],
  ['plan-implementation', 'ee5f3dd776a38d49f5d853b7668666a5ed90d7115aa3a146bb00eae711fc0de7'],
  ['plan-execution', '4cc38db52651b7073d8677ff89b94d896ba0b2321125d8eaef31c6152543e533'],
  ['delivery-compatibility', 'a75ed7bb1c4b64b5563a816c0d718e96012ddb2f781e74f07a7106fe628b35fd'],
  ['executable-red', '22a817a735d42dbb7b6d0e6c27e07711d1fe33025c4380079f388d729982c5fe'],
  ['retrospective-eligibility', '244a158426ec11e190133cc540915b2ed592b21f4325eb5e145aaf38c3b1d4dc'],
  ['retrospective-proof', 'e407521fcded0e710ad6bd5c16cf06554ea584da259521c77f1db64f27d0e26a'],
] as const)('retains the %s prompt identity', (kind, expected) => {
  expect(createHash('sha256').update(reviewPromptContract(kind)).digest('hex')).toBe(expected);
});

function sourceFixture(): string {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-core-source-'));
  roots.push(root);
  for (const part of ['src', 'scripts', 'templates'])
    cpSync(nodePath.join(packageRoot, part), nodePath.join(root, part), { recursive: true });
  cpSync(nodePath.join(packageRoot, 'package.json'), nodePath.join(root, 'package.json'));
  symlinkSync(nodePath.join(packageRoot, 'node_modules'), nodePath.join(root, 'node_modules'));
  return root;
}

function run(root: string, script: string) {
  return spawnSync(launcher, ['bun', '-e', script], {
    cwd: root,
    encoding: 'utf8',
    timeout: 30_000,
  });
}

it('one real owner edit materializes every canonical consumer and changes the actual quality prompt', () => {
  const root = sourceFixture();
  const owner = nodePath.join(root, TESTING_CORE_LAYOUT.owner);
  const original = readFileSync(owner, 'utf8');
  writeFileSync(
    owner,
    original.replace('State the test-scope', 'Current source-controlled test-scope'),
  );
  const generated = run(
    root,
    `
    import {generateTestingCore} from './scripts/generate-testing-core.ts';
    import {testingCoreBlock} from './src/testing/shared-core.ts';
    import {reviewerPromptInstructions} from './src/review/review-rubric.ts';
    import {generateCodexPluginAssets} from './src/host-contract/catalogue.ts';
    import {generateClaudePluginAssets} from './src/claude-plugin/catalogue.ts';
    import {writePortableCoreCatalogue} from './src/host-contract/portable-core.ts';
    import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
    import {reconcile} from './src/reconcile.ts';
    import {SAFEWORD_SCHEMA} from './src/schema.ts';
    import {detectProjectType} from './src/utils/project-detector.ts';
    generateTestingCore(); generateTestingCore(true);
    const core=testingCoreBlock();
    const codex=generateCodexPluginAssets('./templates/skills','0.0.0-test');
    const claude=generateClaudePluginAssets({cliBundle:'console.log("owned fixture");',sourceRoot:process.cwd()+'/src',templatesRoot:process.cwd()+'/templates',version:'0.0.0-test'});
    writePortableCoreCatalogue('./templates','./portable','0.0.0-test');
    const cwd=process.cwd()+'/project'; mkdirSync(cwd);
    const manifest={name:'owned-core-change',private:true,type:'module'};
    writeFileSync(cwd+'/package.json',JSON.stringify(manifest));
    await reconcile(SAFEWORD_SCHEMA,'install',{cwd,projectType:detectProjectType(manifest,cwd),developmentDeps:{},productionDeps:{},isGitRepo:false,languages:{javascript:true,python:false,golang:false,rust:false,sql:false}});
    for(const [path,definition] of Object.entries(SAFEWORD_SCHEMA.ownedFiles))
      if(definition.template && definition.template==='skills/testing/SKILL.md' && !readFileSync(cwd+'/'+path,'utf8').includes(core))throw new Error('Raw reconcile missed current owner');
    const body=(assets,path)=>{const asset=assets.find(a=>a.relativePath===path);if(!asset)throw new Error('Missing actual producer '+path);return asset.content;};
    const paths=['testing','quality-review','tdd-review','debug','refactor'];
    for(const name of paths) {
      const native=codex.find(a=>a.relativePath.endsWith('/'+name+'/SKILL.md'));
      if(!native)throw new Error('Missing native procedure '+name);
      for(const text of [native.content,body(claude,'skills/'+name+'/SKILL.md'),readFileSync('./portable/skills/'+name+'/SKILL.md','utf8')])
        if(!text.includes(core))throw new Error('Producer missed current owner '+name);
    }
    console.log(JSON.stringify({block:core,prompt:reviewerPromptInstructions('quality-review','claude')}));
  `,
  );
  expect(generated.status, generated.stderr).toBe(0);
  const observation = JSON.parse(generated.stdout) as { block: string; prompt: string };
  expect(observation.block).not.toBe(block);
  expect(observation.block).toContain('Current source-controlled test-scope');
  expect(observation.prompt).toContain(observation.block);
  for (const template of TESTING_CORE_LAYOUT.templates)
    expect(readFileSync(nodePath.join(root, 'templates', template), 'utf8')).toContain(
      observation.block,
    );
  const damaged = nodePath.join(root, 'templates/skills/testing/SKILL.md');
  writeFileSync(
    damaged,
    readFileSync(damaged, 'utf8').replace('Current source-controlled', 'Stale'),
  );
  const checked = run(
    root,
    "import {generateTestingCore} from './scripts/generate-testing-core.ts'; generateTestingCore(true);",
  );
  expect(checked.status).not.toBe(0);
  expect(checked.stderr).toContain('essential testing core is stale');
  const rejected = run(
    root,
    `
    import {generateCodexPluginAssets} from './src/host-contract/catalogue.ts';
    import {writePortableCoreCatalogue} from './src/host-contract/portable-core.ts';
    for(const producer of [()=>generateCodexPluginAssets('./templates/skills','0.0.0-test'),()=>writePortableCoreCatalogue('./templates','./rejected','0.0.0-test')]) {
      let rejected=false;try{producer();}catch(error){if(!error.message.includes('Missing or stale essential testing core'))throw error;rejected=true;}
      if(!rejected)throw new Error('Producer accepted stale current owner');
    }
    console.log('two actual producers rejected stale core');
  `,
  );
  expect(rejected.status, rejected.stderr).toBe(0);
  expect(rejected.stdout).toContain('two actual producers rejected stale core');
});

it.each([
  ['empty', ''],
  ['oversized', 'x'.repeat(2049)],
  ['host-only', '$safeword:testing'],
])('real generation rejects an %s owner', (_label, text) => {
  const root = sourceFixture();
  const owner = nodePath.join(root, TESTING_CORE_LAYOUT.owner);
  const original = readFileSync(owner, 'utf8');
  writeFileSync(
    owner,
    original.replace(
      /export const TESTING_CORE_TEXT =[\s\S]*?;\n/u,
      () => `export const TESTING_CORE_TEXT = ${JSON.stringify(text)};\n`,
    ),
  );
  const result = run(
    root,
    "import {generateTestingCore} from './scripts/generate-testing-core.ts'; generateTestingCore();",
  );
  expect(result.status).not.toBe(0);
  expect(result.stderr).toMatch(/owner is empty|byte budget|host-neutral/u);
});

it('real generation fails when the canonical owner is missing', () => {
  const root = sourceFixture();
  rmSync(nodePath.join(root, TESTING_CORE_LAYOUT.owner));
  const result = run(
    root,
    "import {generateTestingCore} from './scripts/generate-testing-core.ts'; generateTestingCore();",
  );
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('shared-core');
  expect(result.stderr).toMatch(/Cannot find|not found/u);
});
