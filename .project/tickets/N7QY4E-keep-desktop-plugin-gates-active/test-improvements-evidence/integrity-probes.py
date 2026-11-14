from pathlib import Path
import tempfile,re,json,subprocess,os
repo=Path.cwd(); package=repo/'packages/cli'; root=Path(tempfile.mkdtemp(prefix='safeword-6004-integrity-proof-'))
def read_test(name):
 path=package/'tests/claude-plugin'/name
 text=path.read_text()
 text=re.sub(r"from '(\.\.?/[^']+)'",lambda match:"from '"+str((path.parent/match[1]).resolve())+"'",text)
 text=text.replace("nodePath.resolve(import.meta.dirname, '../../../..')",json.dumps(str(repo)))
 text=text.replace("nodePath.resolve(import.meta.dirname, '../..')",json.dumps(str(package)))
 return text
catalogue=read_test('catalogue.test.ts'); dispatch=read_test('dispatch.test.ts')
inventory_needle='    const skills = assets.filter('
assert catalogue.count(inventory_needle)==1
faulted_catalogue=catalogue.replace(inventory_needle,"    const omitted = inventory.assets.find(asset => asset.path.startsWith('skills/') && asset.path.endsWith('/SKILL.md') && asset.path !== 'skills/audit/SKILL.md');\n    if (omitted === undefined) throw new Error('No alternate skill available for fault probe');\n    delete omitted.skill_sha256;\n"+inventory_needle)
proof_needle="    const proofPath = nodePath.join(pluginData, 'execution-proofs-v2', `${digest}.json`);"
assert dispatch.count(proof_needle)==1
missing=dispatch.replace(proof_needle,proof_needle+'\n    rmSync(proofPath);')
wrong=dispatch.replace(proof_needle,proof_needle+"\n    const wrongProof = JSON.parse(readFileSync(proofPath, 'utf8'));\n    wrongProof.session_id = 'another-session';\n    writeFileSync(proofPath, JSON.stringify(wrongProof));")
variants={'baseline':(catalogue,dispatch),'missing-alternate-skill-digest':(faulted_catalogue,dispatch),'empty-proof-directory':(catalogue,missing),'wrong-proof-session':(catalogue,wrong)}
results={}
for name,(cat,disp) in variants.items():
 location=root/name; location.mkdir(); (location/'node_modules').symlink_to(package/'node_modules',target_is_directory=True)
 (location/'catalogue.test.ts').write_text(cat); (location/'dispatch.test.ts').write_text(disp)
 config=location/'vitest.config.mjs'; config.write_text('export default '+json.dumps({'root':str(location),'test':{'include':['*.test.ts'],'testTimeout':60000,'hookTimeout':60000,'maxWorkers':1,'fileParallelism':False}})+';\n')
 cmd=['../../scripts/dev','bun','run','test','--config',str(config),'-t','records the semantic digest of every exposed skill|runs prompt hooks after desktop sync normalizes skill front matter']
 result=subprocess.run(cmd,cwd=package,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
 log=location/'result.log'; log.write_text(result.stdout); results[name]={'exit_code':result.returncode,'log':str(log)}
 print(name,result.returncode,flush=True)
print(json.dumps({'root':str(root),'results':results},indent=2))
