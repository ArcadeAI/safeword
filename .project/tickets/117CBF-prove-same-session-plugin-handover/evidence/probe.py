from pathlib import Path
import tempfile, os, json, subprocess
repo=Path.cwd()
source=(repo/'steps/native-claude-plugin.steps.ts').read_text()
source=source.replace("from '../packages/", "from '"+str(repo)+"/packages/")
source=source.replace("nodePath.resolve(import.meta.dirname, '..')",json.dumps(str(repo)))
transition="    runAuthorityHook(this, 'PreToolUse');\n    executeLegacyConfigGuard(this);\n  },\n);\n\nThen('the plugin functional effect occurs exactly once'"
assert source.count(transition)==1
mutants={
 'baseline':source,
 'skip-cleanup':source.replace("const cleanup = runLifecycleCommand(this, ['claude', 'cleanup', '--yes', '--plan', plan]);", "const cleanup = {status: 0, output: JSON.stringify({data: {classification: 'plugin-mode'}})};"),
 'omit-plugin-after-cleanup':source.replace(transition, transition.replace("    runAuthorityHook(this, 'PreToolUse');", '    // plugin stays suppressed')),
 'duplicate-plugin-after-cleanup':source.replace(transition, transition.replace("    runAuthorityHook(this, 'PreToolUse');", "    runAuthorityHook(this, 'PreToolUse');\n    runAuthorityHook(this, 'PreToolUse');")),
 'restart-session':source.replace("sessionId: 'authority-test',\n    plugin:", "sessionId: world.cacheFixture.authorityInvocations?.length === 2 ? 'restarted-session' : 'authority-test',\n    plugin:"),
 'omit-legacy-before-cleanup':source.replace("    executeLegacyConfigGuard(this);\n    assert.equal(this.cacheFixture.result?.status", "    // no legacy execution\n    assert.equal(this.cacheFixture.result?.status"),
}
root=Path(tempfile.mkdtemp(prefix='safeword-m2-probes-'))
(root/'node_modules').symlink_to(repo/'node_modules',target_is_directory=True)
results={}
for name,body in mutants.items():
 assert name=='baseline' or body!=source, name
 steps=root/(name+'.ts'); steps.write_text(body)
 config=root/(name+'.mjs'); config.write_text('export default '+json.dumps({'import':['tsx/esm',str(steps)],'tags':'not @wip and not @proof.vitest and not @manual and not @live'})+';\n')
 cmd=['scripts/dev','node','--import','tsx','node_modules/@cucumber/cucumber/bin/cucumber.js','--config',os.path.relpath(config,repo),'features/native-claude-plugin.feature','--name','^The loaded plugin becomes authoritative in the same task after cleanup$','--format','summary']
 result=subprocess.run(cmd,cwd=repo,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
 (root/(name+'.log')).write_text(result.stdout)
 results[name]={'exit_code':result.returncode,'log':str(root/(name+'.log'))}
 print(name,result.returncode,flush=True)
print(json.dumps({'root':str(root),'results':results},indent=2))
(root/'results.json').write_text(json.dumps(results,indent=2))
