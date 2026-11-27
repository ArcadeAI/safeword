import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

import { parse as parseToml } from 'smol-toml';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';

import packageMetadata from '../../package.json';
import hostReleases from '../../src/lifecycle/host-releases.json';
import {
  CodexInternalWorkflowActor,
  codexWorkflowTemporaryBase,
  requireCodexNativeTrust,
} from '../helpers/codex-internal-workflows.js';
import type { CodexGuardFixture } from '../helpers/codex-native-continuation.js';

const temporary = mkdtempSync(path.join(codexWorkflowTemporaryBase(), 'codex-guard-'));
const root = realpathSync(temporary);
const repo = path.resolve(process.cwd(), '../..');
const source = path.join(root, 'generated');
const fixtureFile = path.join(root, 'fixture.json');
const identityFile = path.join(root, 'provisioning.json');
const faultFile = path.join(root, 'vendor-fault');
const digest = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');

// Only the external Codex CLI/inventory is substituted. Generation, installation
// tree checks and actor preparation are real; this is not native trust evidence.
beforeAll(() => {
  const generated = spawnSync(
    path.join(repo, 'scripts/dev'),
    [
      'bun',
      'packages/cli/scripts/generate-codex-plugin.ts',
      '--version',
      packageMetadata.version,
      '--output',
      source,
    ],
    { cwd: repo, encoding: 'utf8' },
  );
  expect(generated.status, generated.stderr).toBe(0);
  const profile = path.join(root, 'profile');
  const project = path.join(root, 'project');
  const installedPath = path.join(profile, 'plugins/cache/original');
  mkdirSync(project);
  mkdirSync(profile);
  cpSync(source, installedPath, { recursive: true });
  writeFileSync(path.join(profile, 'auth.json'), '{"synthetic_external_auth":true}');
  writeFileSync(path.join(profile, 'config.toml'), '[hooks.state]\nsentinel = "DO_NOT_TRANSFER"\n');
  const binary = path.join(root, 'vendor');
  writeFileSync(
    binary,
    `#!${process.execPath}
const fs=require('node:fs'),path=require('node:path');
const profile=process.env.CODEX_HOME,base=path.dirname(profile);
const args=process.argv.slice(2),version=${JSON.stringify(hostReleases.codex.version)};
const registry=path.join(base,'marketplace/.agents/plugins/marketplace.json');
const candidate=path.join(base,'marketplace/plugin');
const installed=path.join(profile,'plugins/cache/safeword-contract-test/safeword',${JSON.stringify(packageMetadata.version)});
const faultFile=${JSON.stringify(faultFile)};
const fault=fs.existsSync(faultFile)?fs.readFileSync(faultFile,'utf8'):'';
if(args.includes('--version')){console.log('codex-cli '+version);process.exit(0);}
if(args.includes('marketplace')){console.log('{}');process.exit(0);}
if(args.includes('plugin')&&args.includes('add')){
 if(!fs.existsSync(registry))throw Error('marketplace not registered');
 fs.cpSync(candidate,installed,{recursive:true});console.log(JSON.stringify({installedPath:installed}));process.exit(0);
}
if(args.includes('app-server')){
 const lines=require('node:readline').createInterface({input:process.stdin});
 lines.on('line',line=>{const request=JSON.parse(line);
 if(request.id===1)console.log(JSON.stringify({id:1,result:{}}));
 if(request.id===2&&fault==='tree')fs.appendFileSync(path.join(installed,'runtime/cli.js'),'changed');
 if(request.id===2)console.log(JSON.stringify({id:2,result:{data:[{errors:[],warnings:[],hooks:
 ['postToolUse','preToolUse','sessionStart','stop','userPromptSubmit'].filter(eventName=>fault!=='missing'||eventName!=='stop').map(eventName=>({eventName,enabled:true,trustStatus:fault.startsWith('untrusted')?'untrusted':'trusted',sourcePath:fault==='manifest'?${JSON.stringify(path.join(profile, 'plugins/cache/original/hooks.json'))}:path.join(installed,'hooks.json')}))}]}}));
 if(request.id===2&&fault==='untrusted-once')fs.writeFileSync(faultFile,'');
 });
}else throw Error('unexpected vendor request '+JSON.stringify(args));
`,
    { mode: 0o755 },
  );
  const originalManifest = digest(path.join(installedPath, 'hooks.json'));
  const packageManifestSha256 = digest(path.join(installedPath, '.codex-plugin/plugin.json'));
  const runtimeSha256 = digest(path.join(installedPath, 'runtime/cli.js'));
  writeFileSync(
    fixtureFile,
    JSON.stringify({
      root,
      profile,
      project,
      installedPath,
      binary,
      hookManifestSha256: originalManifest,
      packageManifestSha256,
    }),
  );
  writeFileSync(
    identityFile,
    JSON.stringify({
      originalManifest,
      runtimeSha256,
    }),
  );
}, 120_000);

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});
afterEach(() => {
  writeFileSync(faultFile, '');
  vi.restoreAllMocks();
});

function stagedFixture(): { fixture: CodexGuardFixture; candidate: string } {
  const stage = mkdtempSync(path.join(root, 'internal-workflows-'));
  const profile = path.join(stage, 'profile');
  const project = path.join(stage, 'project');
  const installedPath = path.join(
    profile,
    'plugins/cache/safeword-contract-test/safeword',
    packageMetadata.version,
  );
  const candidate = path.join(stage, 'marketplace/plugin');
  mkdirSync(project);
  cpSync(source, candidate, { recursive: true });
  cpSync(source, installedPath, { recursive: true });
  return {
    fixture: { root: stage, profile, project, installedPath, binary: path.join(root, 'vendor') },
    candidate,
  };
}

it('prepares a fresh child without transferring parent hook grants', async () => {
  const actor = new CodexInternalWorkflowActor(fixtureFile, identityFile);
  await actor.prepare();
  const childConfig = parseToml(
    readFileSync(path.join(actor.artifacts, 'profile/config.toml'), 'utf8'),
  );
  expect(childConfig).toEqual({ check_for_update_on_startup: false });
  expect(readFileSync(path.join(root, 'profile/config.toml'), 'utf8')).toBe(
    '[hooks.state]\nsentinel = "DO_NOT_TRANSFER"\n',
  );
}, 120_000);

it.each([
  ['untrusted', 'requires native hook trust'],
  ['manifest', 'CODEX_NATIVE_HOOK_SOURCE_MISMATCH'],
  ['missing', 'native Codex hook inventory differs'],
  ['tree', 'Packed Codex plugin generated artifact differs: runtime/cli.js'],
  ['profile', 'prepared profile differs'],
] as const)('refuses %s preparation before any trial', async (fault, reason) => {
  const { fixture, candidate } = stagedFixture();
  writeFileSync(faultFile, fault);
  if (fault === 'profile') fixture.profile = path.join(root, 'profile');
  await expect(requireCodexNativeTrust(fixture, candidate)).rejects.toThrow(reason);
});

it('observes review of the same staged tree without generating or granting trust', async () => {
  const { fixture, candidate } = stagedFixture();
  const runtime = path.join(fixture.installedPath, 'runtime/cli.js');
  const before = digest(runtime);
  writeFileSync(faultFile, 'untrusted-once');
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  const hooks = await requireCodexNativeTrust(fixture, candidate, Date.now() + 30_000);
  expect(hooks).toHaveLength(5);
  expect(digest(runtime)).toBe(before);
  const message = log.mock.calls[0]?.[0] as string;
  expect(JSON.parse(message.slice('CODEX_NATIVE_TRUST_PENDING '.length))).toEqual(fixture);
  expect(readFileSync(faultFile, 'utf8')).toBe('');
});

it('rejects a descriptor whose prepared runtime no longer matches its identity', () => {
  const bad = path.join(root, 'wrong-runtime.json');
  const identity = JSON.parse(readFileSync(identityFile, 'utf8'));
  writeFileSync(bad, JSON.stringify({ ...identity, runtimeSha256: 'wrong-runtime' }));
  expect(() => new CodexInternalWorkflowActor(fixtureFile, bad)).toThrow(
    'provisioning runtime changed',
  );
});
