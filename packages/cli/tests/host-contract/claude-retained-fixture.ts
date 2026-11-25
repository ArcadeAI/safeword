import { cpSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import options from '../fixtures/host-contract/documented-option-composition.json';
import architecture from '../fixtures/host-contract/propagation-architecture-case.json';
import { ClaudeNativeCatalogueActor } from '../helpers/claude-native-catalogue.js';
import { createCanonicalCatalogueInputs } from '../helpers/native-catalogue-probe.js';
import { createPropagationSource } from '../helpers/propagation-source.js';

export const previousHelperMarker = 'HELPER_11111111-1111-4111-a111-111111111111';

/** Only the external host is substituted; generated plugin and Stop run normally. */
export async function prepareClaudeRetainedFixture(
  fault: 'none' | 'missing' | 'excess' | 'foreign' = 'none',
) {
  const temporary = mkdtempSync(path.join(tmpdir(), 'claude-retained-'));
  const root = realpathSync(temporary);
  const inputs = createCanonicalCatalogueInputs(root);
  const sourcePackage = createPropagationSource(root, inputs);
  const runtimePath = path.join(root, 'marketplace/plugin');
  const profile = path.join(root, 'profile');
  const installedPath = path.join(profile, 'plugins/cache/synthetic');
  mkdirSync(installedPath, { recursive: true });
  const original = path.resolve(import.meta.dirname, '../../../../plugin');
  cpSync(original, runtimePath, { recursive: true });
  cpSync(original, installedPath, { recursive: true });
  const binary = path.join(root, 'host');
  const script = path.join(root, 'host.mjs');
  writeFileSync(
    binary,
    `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(script)} "$@"\n`,
    { mode: 0o755 },
  );
  writeFileSync(
    script,
    `
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
if (process.argv.includes('--version')) { console.log('2.1.319 (Claude Code)'); process.exit(0); }
if (process.argv.includes('list')) { console.log(JSON.stringify([{id:'safeword@safeword',enabled:true,installPath:${JSON.stringify(installedPath)}}])); process.exit(0); }
const runtime=process.env.SAFEWORD_OBSERVER_RUNTIME.slice(0,-'/runtime/dispatch.js'.length);
const resume=process.argv.includes('--resume');
const session=process.argv[process.argv.indexOf(resume?'--resume':'--session-id')+1];
const sessions=${JSON.stringify(path.join(root, 'sessions.json'))};
const previous=existsSync(sessions)?JSON.parse(readFileSync(sessions,'utf8')):[];
if(resume!==previous.includes(session))throw Error('invalid session lifecycle');
if(!resume){previous.push(session);writeFileSync(sessions,JSON.stringify(previous));}
const prompt=process.argv[process.argv.indexOf('-p')+1];
const marker=/Reply only (FINISH_[a-f0-9-]+)/.exec(prompt)?.[1];
const fault=${JSON.stringify(fault)};
console.log(JSON.stringify({type:'system',subtype:'init',plugins:[{name:'safeword',path:runtime}]}));
const emit=text=>console.log(JSON.stringify({type:'assistant',message:{content:[{type:'text',text}]}}));
if (prompt.startsWith('Invoke /safeword:explain')) {
 const guide=runtime+'/skills/explain/HOST_CONTRACT_GUIDE.md';
 const helper=runtime+'/runtime/hooks/audit-principle-trace.ts';
 const command='bun '+helper+' '+process.cwd();
 const result=spawnSync('bun',[helper,process.cwd()],{encoding:'utf8'});
 if(result.status!==0)throw Error(result.stderr);
 const event=(type,content)=>console.log(JSON.stringify({type,message:{content}}));
 console.log(JSON.stringify({type:'system',subtype:'hook_response',output:${JSON.stringify(previousHelperMarker)}}));
 event('assistant',[
  {type:'tool_use',name:'Skill',input:{skill:'safeword:explain'}},
  {type:'tool_use',name:'Read',input:{file_path:guide}},
  {type:'tool_use',name:'Bash',id:'catalogue-helper',input:{command}}
 ]);
 event('user',[
  {type:'tool_result',content:readFileSync(runtime+'/skills/explain/SKILL.md','utf8')},
  {type:'tool_result',content:readFileSync(guide,'utf8')},
  {type:'tool_result',tool_use_id:'catalogue-helper',content:result.stdout}
 ]);
 emit(result.stdout.trim());
 console.log(JSON.stringify({type:'result',is_error:false}));
 process.exit(0);
}
function stop(active,text){
 const hooks=JSON.parse(readFileSync(runtime+'/hooks/hooks.json','utf8'));
 const binding=hooks.hooks.Stop.flatMap(row=>row.hooks).find(row=>row.command.includes('/stop-quality.ts'));
 const result=spawnSync('sh',['-c',binding.command],{encoding:'utf8',env:{...process.env,CLAUDE_PLUGIN_ROOT:runtime,CLAUDE_PROJECT_DIR:process.cwd(),SAFEWORD_CLI:undefined,SAFEWORD_PLUGIN_CLI:runtime+'/runtime/cli.js'},input:JSON.stringify({cwd:process.cwd(),session_id:active&&fault==='foreign'?'foreign-session':session,hook_event_name:'Stop',stop_hook_active:active,last_assistant_message:text})});
 if(result.status!==0)throw Error(result.stderr);
 return JSON.parse(result.stdout.trim()||'{}');
}
const initial=marker??'READY'; emit(initial);
const decision=stop(false,initial);
if(marker&&decision.decision==='block'&&fault!=='missing'){emit('Missing verify.md verification.');stop(true,'Missing verify.md verification.');if(fault==='excess')stop(true,'Missing verify.md verification.');}
console.log(JSON.stringify(marker?{type:'result',subtype:'error_max_turns',is_error:true,session_id:session}:{type:'result',is_error:false}));
`,
  );
  const actor = new ClaudeNativeCatalogueActor({
    root,
    binary,
    profile,
    installedPath,
    runtimePath,
  });
  try {
    await actor.prepare({ ...inputs, sourcePackage });
    const disabled = options[4];
    if (!disabled) throw new Error('documented option fixture missing');
    const prior = await actor.observeVerification(
      '**PR Scope:** ✅ Synthetic fixture matches its scope\n',
      { ...architecture, options: disabled },
    );
    return {
      actor,
      inputs,
      prior,
      root,
      runtimePath,
      close: () => {
        actor.close();
        rmSync(root, { recursive: true, force: true });
      },
    };
  } catch (error) {
    actor.close();
    rmSync(root, { recursive: true, force: true });
    throw error;
  }
}
