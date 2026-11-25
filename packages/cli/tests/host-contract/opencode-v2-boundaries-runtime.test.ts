import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

import { installOpenCodeProfile } from '../../src/opencode/profile.js';

it('gates real SDK worker callbacks by enrollment and narrows only recognized child tools', () => {
  const prefix = nodePath.join(tmpdir(), 'v2-worker-boundaries-');
  const root = realpathSync(mkdtempSync(prefix));
  try {
    const candidate = nodePath.join(root, 'candidate'),
      project = nodePath.join(root, 'project'),
      profile = nodePath.join(root, 'profile'),
      inactive = nodePath.join(root, 'inactive');
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
    mkdirSync(inactive);
    writeFileSync(nodePath.join(project, '.safeword/SAFEWORD.md'), '# synthetic\n');
    const workerFile = nodePath.join(candidate, 'workers.json');
    const workers = JSON.parse(readFileSync(workerFile, 'utf8')) as {
      name: string;
      tools?: string[];
    }[];
    const reviewer = workers.find(row => row.name === 'safeword-reviewer');
    expect(reviewer).toEqual({ name: 'safeword-reviewer', tools: ['Read'] });
    const procedure = readFileSync(
      nodePath.join(candidate, 'templates/agents/safeword-reviewer.md'),
      'utf8',
    );
    expect(procedure).toMatch(/^tools: Read$/mu);
    expect(procedure).toContain('fresh-context');
    expect(
      installOpenCodeProfile(profile, {
        nativeV2: {
          projectDirectory: project,
          packageDirectory: candidate,
          epoch: 'component-only',
        },
      }).state,
    ).toBe('changed');
    const driver = nodePath.join(root, 'worker.mjs');
    writeFileSync(
      driver,
      String.raw`import {pathToFileURL} from 'node:url';
const plugin=(await import(pathToFileURL(process.argv[2]).href)).default;
const hooks=[],gets=[];const editor={list:()=>[],add:()=>{}};
await plugin.setup({options:{profileDirectory:process.argv[3]},location:{directory:process.cwd()},app:{version:process.argv[4]},
tool:{hook:async()=>{}},session:{hook:async(event,fn)=>hooks.push({event,fn}),get:async({sessionID})=>{gets.push(sessionID);return {id:sessionID,...(sessionID==='parent'?{}:{parentID:'parent'})};}},
skill:{transform:async fn=>{fn(editor);return {dispose:async()=>{}};}},command:{transform:async()=>{}}});
async function prompt(sessionID,text){for(const h of hooks.filter(row=>row.event==='prompt'))await h.fn({sessionID,prompt:{text}});}
async function context(sessionID,messages){const event={sessionID,messages,system:[],options:{},tools:{read:{},shell:{},write:{},edit:{}}};for(const h of hooks.filter(row=>row.event==='context'))await h.fn(event);return event;}
const header='Safeword worker: safeword-reviewer';
await prompt('parent',header);const parent=await context('parent',[{role:'user',content:'PARENT_PRIVATE_NONCE'}]);
const before=await context('child',[]);await prompt('child',header+'\nRead the accepted synthetic packet.');const child=await context('child',[]);
await prompt('other','ordinary unrelated request');const other=await context('other',[]);
await prompt('unknown','Safeword worker: not-a-canonical-worker');const unknown=await context('unknown',[]);
console.log(JSON.stringify({events:hooks.map(row=>row.event),gets,parent,before,child,other,unknown}));
`,
    );
    function invoke(selected: string, activeProfile = selected, version = '2.2.6') {
      return spawnSync('bun', [driver, nodePath.join(candidate, 'index.js'), selected, version], {
        cwd: project,
        env: {
          ...process.env,
          HOME: nodePath.join(root, 'home'),
          OPENCODE_CONFIG_DIR: activeProfile,
        },
        encoding: 'utf8',
        timeout: 30_000,
      });
    }
    const active = invoke(profile);
    expect(active.error).toBeUndefined();
    expect(active.status, active.stderr).toBe(0);
    const observed = JSON.parse(active.stdout);
    expect(Object.keys(observed.child.tools)).toEqual(['read']);
    // Input preservation only; native child creation/isolation is outside this component.
    expect(observed.child.messages).toEqual([]);
    expect(observed.child.system).toEqual([]);
    expect(observed.parent.messages).toEqual([{ role: 'user', content: 'PARENT_PRIVATE_NONCE' }]);
    for (const state of [observed.parent, observed.before, observed.other, observed.unknown])
      expect(Object.keys(state.tools)).toEqual(['read', 'shell', 'write', 'edit']);
    expect(observed.gets).toEqual(['parent', 'child']);
    const absent = invoke(inactive);
    expect(absent.status, absent.stderr).toBe(0);
    const disabled = JSON.parse(absent.stdout);
    expect(disabled.events).toEqual([]);
    expect(disabled.gets).toEqual([]);
    expect(Object.keys(disabled.child.tools)).toEqual(['read', 'shell', 'write', 'edit']);
    const marker = nodePath.join(project, '.safeword/SAFEWORD.md');
    for (const rejected of [invoke(profile, inactive), invoke(profile, profile, '1.18.23')]) {
      expect(rejected.status, rejected.stderr).toBe(0);
      expect(JSON.parse(rejected.stdout).events).toEqual([]);
    }
    unlinkSync(marker);
    const missingMarker = invoke(profile);
    expect(missingMarker.status, missingMarker.stderr).toBe(0);
    expect(JSON.parse(missingMarker.stdout).events).toEqual([]);
    writeFileSync(marker, '# synthetic\n');
    // Owned negative fixture data, never proof or an enrolled customer package.
    if (!reviewer) throw new Error('Missing canonical reviewer');
    reviewer.tools = ['Write'];
    writeFileSync(workerFile, JSON.stringify(workers));
    const unsupported = invoke(profile);
    expect(unsupported.status).not.toBe(0);
    expect(unsupported.stderr).toContain(
      'OpenCode V2 cannot preserve worker tool authority: safeword-reviewer/Write',
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
