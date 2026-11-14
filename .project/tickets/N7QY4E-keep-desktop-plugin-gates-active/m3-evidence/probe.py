from pathlib import Path
import tempfile,os,json,subprocess,gzip
repo=Path.cwd(); source=(repo/'steps/native-claude-plugin.steps.ts').read_text()
source=source.replace("from '../packages/", "from '"+str(repo)+"/packages/").replace("nodePath.resolve(import.meta.dirname, '..')",json.dumps(str(repo)))
needle="  this.lifecycle!.result = runLifecycleCommand(this, ['claude', 'status']);"
assert source.count(needle)==1
faults={
 'wrong-classification': "result.data.classification = 'plugin-mode';",
 'wrong-exit': "this.lifecycle!.result.status = 0;",
 'wrong-action': "result.next_actions[0].command = 'safeword claude cleanup';",
 'plugin-state-mutation': "const target = lifecycleStatePath(this.lifecycle!.configRoot!, this.lifecycle!.project, 'plugin-mode-v2.json'); mkdirSync(nodePath.dirname(target), {recursive:true}); writeFileSync(target, JSON.stringify({schema_version:2,state:'clean'}));",
 'transaction-mutation': "const target = lifecycleStatePath(this.lifecycle!.configRoot!, this.lifecycle!.project, 'cleanup-transaction-v1.json'); mkdirSync(nodePath.dirname(target), {recursive:true}); writeFileSync(target, JSON.stringify({schema_version:1}));",
 'project-mutation': "appendFileSync(nodePath.join(this.lifecycle!.project, '.claude/skills/quality-review/SKILL.md'), 'unexpected mutation');",
}
variants={'baseline':source}
for name,fault in faults.items():
 variants[name]=source.replace(needle,needle+"\n  const result = JSON.parse(this.lifecycle!.result.output);\n  if (result.data?.classification === 'coexistence') {\n    "+fault+"\n    this.lifecycle!.result.output = JSON.stringify(result);\n  }")
variants['old-snapshot-misses-state-write'] = variants['plugin-state-mutation'].replace('includeProjectState = true', 'includeProjectState = false')
root=Path(tempfile.mkdtemp(prefix='safeword-m3-probes-')); (root/'node_modules').symlink_to(repo/'node_modules',target_is_directory=True)
results={}
for name,body in variants.items():
 steps=root/(name+'.ts'); steps.write_text(body)
 config=root/(name+'.mjs'); config.write_text('export default '+json.dumps({'import':['tsx/esm',str(steps)],'tags':'not @wip and not @proof.vitest and not @manual and not @live'})+';\n')
 result=subprocess.run(['scripts/dev','node','--import','tsx','node_modules/@cucumber/cucumber/bin/cucumber.js','--config',os.path.relpath(config,repo),'features/native-claude-plugin.feature','--name','^Ready plugin states are classified without mutation$','--format','summary'],text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
 (root/(name+'.log')).write_text(result.stdout); results[name]={'exit_code':result.returncode,'log':str(root/(name+'.log'))}; print(name,result.returncode,flush=True)
print(json.dumps({'root':str(root),'results':results},indent=2))
