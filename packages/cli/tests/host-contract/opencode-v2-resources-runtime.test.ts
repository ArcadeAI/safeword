import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

import { installOpenCodeProfile } from '../../src/opencode/profile.js';

it('projects canonical skills, refreshes after discovery and forwards command attachments through generated SDK callbacks', () => {
  const prefix = nodePath.join(tmpdir(), 'v2-resource-callbacks-');
  const root = realpathSync(mkdtempSync(prefix));
  try {
    const candidate = nodePath.join(root, 'candidate'),
      project = nodePath.join(root, 'project'),
      profile = nodePath.join(root, 'profile');
    const build = spawnSync(
      'bun',
      ['scripts/generate-opencode-v2-plugin.ts', '--output', candidate],
      { cwd: nodePath.resolve(import.meta.dirname, '../..'), encoding: 'utf8', timeout: 120_000 },
    );
    expect(build.error).toBeUndefined();
    expect(build.status, build.stderr).toBe(0);
    symlinkSync(
      nodePath.resolve(import.meta.dirname, '../../../opencode-v2-plugin/node_modules'),
      nodePath.join(root, 'node_modules'),
      'dir',
    );
    mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
    mkdirSync(profile);
    writeFileSync(nodePath.join(project, '.safeword/SAFEWORD.md'), '# synthetic\n');
    const staged = installOpenCodeProfile(profile, {
      nativeV2: { projectDirectory: project, packageDirectory: candidate, epoch: 'component-only' },
    });
    expect(staged.state).toBe('changed');
    const driver = nodePath.join(root, 'callbacks.mjs');
    writeFileSync(
      driver,
      `import {pathToFileURL} from 'node:url';
const plugin=(await import(pathToFileURL(process.argv[2]).href)).default;
const prompts=[],commands=[],skills=new Map(),hooks=[];let disposed=0,transforms=0;
const editor={list:()=>[...skills.values()],add:skill=>skills.set(String(skill.name),skill)};
await plugin.setup({options:{profileDirectory:process.argv[3]},location:{directory:process.cwd()},app:{version:'2.2.6'},
tool:{hook:async()=>{}},session:{hook:async(event,fn)=>{hooks.push({event,fn});},prompt:async input=>{prompts.push(input);},get:async()=>({id:'root'})},
skill:{transform:async fn=>{transforms++;fn(editor);return {dispose:async()=>{disposed++;}};}},
command:{transform:async fn=>fn({add:command=>commands.push(command)})}});
const bdd=skills.get('safeword-bdd');if(!bdd)throw Error('Canonical BDD skill missing');
const initial={name:bdd.name,content:bdd.content,path:bdd.path};
// Simulate SDK file discovery replacing content; the actual registered refresh must restore it.
skills.set('safeword-bdd',{...bdd,content:'foreign discovery overwrite'});
for(let count=0;count<2;count++)for(const hook of hooks.filter(row=>row.event==='prompt'))await hook.fn({sessionID:'root',prompt:{text:'ordinary prompt'}});
const command=commands.find(row=>row.name==='safeword-bdd');if(!command)throw Error('Canonical BDD command missing');
await command.execute({sessionID:'component-session',delivery:'queue',prompt:{text:'literal arguments',files:[{uri:'file:///synthetic/file'}],agents:[{name:'synthetic'}],skills:[{id:'existing-skill'}]}});
console.log(JSON.stringify({initial,refreshed:skills.get('safeword-bdd').content,transforms,disposed,prompts}));
`,
    );
    const result = spawnSync('bun', [driver, nodePath.join(candidate, 'index.js'), profile], {
      cwd: project,
      env: { ...process.env, OPENCODE_CONFIG_DIR: profile, HOME: nodePath.join(root, 'home') },
      encoding: 'utf8',
      timeout: 30_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    const observed = JSON.parse(result.stdout);
    const canonical = readFileSync(nodePath.join(candidate, 'skills/bdd/SKILL.md'), 'utf8').replace(
      /^---\r?\n[\s\S]*?\r?\n---\r?\n/u,
      '',
    );
    expect(canonical).toContain('# BDD Orchestrator');
    expect(canonical).toContain('references/TDD.md');
    expect(observed.initial.content).toBe(canonical);
    expect(observed.initial.path).toBe(nodePath.join(candidate, 'skills/bdd/SKILL.md'));
    expect(observed.refreshed).toBe(canonical);
    expect(observed.transforms).toBe(2);
    expect(observed.disposed).toBe(1);
    expect(observed.prompts).toEqual([
      {
        sessionID: 'component-session',
        delivery: 'queue',
        text: 'literal arguments',
        files: [{ uri: 'file:///synthetic/file' }],
        agents: [{ name: 'synthetic' }],
        skills: [{ id: 'existing-skill' }, { id: 'safeword-bdd' }],
      },
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
