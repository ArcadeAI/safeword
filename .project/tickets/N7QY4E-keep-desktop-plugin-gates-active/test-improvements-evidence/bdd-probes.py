from pathlib import Path
import tempfile,os,json,subprocess
repo=Path.cwd(); source=(repo/'steps/native-claude-plugin.steps.ts').read_text().replace("from '../packages/", "from '"+str(repo)+"/packages/").replace("nodePath.resolve(import.meta.dirname, '..')",json.dumps(str(repo)))
cleanup="      ? runLifecycleCommand(this, ['claude', 'cleanup', '--yes', '--plan', plan])\n      : preview;"
assert source.count(cleanup)==1
corrupt="\n  const otherState = nodePath.join(this.lifecycle!.configRoot!, 'plugins/data/safeword-safeword/project-state-v1', 'f'.repeat(64), 'plugin-mode-v2.json');\n  mkdirSync(nodePath.dirname(otherState), {recursive: true});\n  writeFileSync(otherState, 'corrupted unrelated project state');"
decline="    this.lifecycle!.result = runLifecycleCommand(this, ['claude', 'cleanup']);"
assert source.count(decline)==1
forbidden="\n    const attempted = spawnSync(nodePath.join(this.lifecycle!.root, 'bin/claude'), ['plugin','reload'], {env: {...process.env, FAKE_CLAUDE_STATE:this.lifecycle!.statePath, FAKE_CLAUDE_LOG:this.lifecycle!.claudeLogPath, CLAUDE_CONFIG_DIR:this.lifecycle!.configRoot},encoding:'utf8'});\n    assert.equal(attempted.status, 64, attempted.stderr);\n    assert.ok(readFileSync(this.lifecycle!.claudeLogPath,'utf8').includes(JSON.stringify(['plugin','reload'])));"
variants={'baseline':source,'unrelated-project-state-corruption':source.replace(cleanup,cleanup+corrupt),'failed-forbidden-reload':source.replace(decline,decline+forbidden)}
root=Path(tempfile.mkdtemp(prefix='safeword-6004-assess-')); (root/'node_modules').symlink_to(repo/'node_modules',target_is_directory=True)
for name,body in variants.items():
 steps=root/(name+'.ts'); steps.write_text(body); config=root/(name+'.mjs'); config.write_text('export default '+json.dumps({'import':['tsx/esm',str(steps)],'tags':'not @wip and not @proof.vitest and not @manual and not @live'})+';\n')
 result=subprocess.run(['scripts/dev','node','--import','tsx','node_modules/@cucumber/cucumber/bin/cucumber.js','--config',os.path.relpath(config,repo),'features/native-claude-plugin.feature','--name','^(Cleanup removes recognized Safeword entries from mixed Claude configuration|Declining cleanup confirmation leaves profile and project state unchanged)$','--format','summary'],text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
 (root/(name+'.log')).write_text(result.stdout); print(name,result.returncode,flush=True)
print('Evidence:',root)
