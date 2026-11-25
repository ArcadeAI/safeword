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

import { afterAll, afterEach, expect, it, vi } from 'vitest';

import hostReleases from '../../src/lifecycle/host-releases.json';
import {
  CodexInternalWorkflowActor,
  codexWorkflowTemporaryBase,
  requireCodexNativeTrust,
} from '../helpers/codex-internal-workflows.js';

// Real actor/readiness/tree checks; only external inventory and clock are fake.
const prefix = path.join(codexWorkflowTemporaryBase(), 'codex-guard-window-');
const root = realpathSync(mkdtempSync(prefix));
const profile = path.join(root, 'profile');
const project = path.join(root, 'project');
const installedPath = path.join(profile, 'plugins/cache/child');
cpSync(path.resolve(import.meta.dirname, '../../codex-plugin'), installedPath, { recursive: true });
mkdirSync(project);
writeFileSync(path.join(profile, 'config.toml'), 'check_for_update_on_startup=false\n');
const hash = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
const control = path.join(root, 'inventory.json');
const binary = path.join(root, 'vendor');
writeFileSync(
  binary,
  `#!${process.execPath}
const fs=require('node:fs'),path=require('node:path');
if(process.argv.includes('--version')){console.log('codex-cli ${hostReleases.codex.version}');process.exit(0);}
const input=require('node:readline').createInterface({input:process.stdin});
input.on('line',line=>{const q=JSON.parse(line);
 if(q.id===1)console.log(JSON.stringify({id:1,result:{}}));
 if(q.id===2){const c=JSON.parse(fs.readFileSync(${JSON.stringify(control)},'utf8'));
 c.requests++;fs.writeFileSync(${JSON.stringify(control)},JSON.stringify(c));
 console.log(JSON.stringify({id:2,result:{data:[{errors:[],warnings:[],hooks:
 ['sessionStart','userPromptSubmit','preToolUse','postToolUse','stop'].map(eventName=>({eventName,enabled:true,
 trustStatus:c.requests>c.untrusted?'trusted':'untrusted',
 sourcePath:path.join(process.env.CODEX_HOME,'plugins/cache/child/hooks.json')}))}]}}));}
});
`,
  { mode: 0o755 },
);
const fixture = { root, profile, project, installedPath, binary };
const identity = path.join(root, 'identity.json');
const originalManifest = hash(path.join(installedPath, 'hooks.json'));
const runtimeSha256 = hash(path.join(installedPath, 'runtime/cli.js'));
const packageManifestSha256 = hash(path.join(installedPath, '.codex-plugin/plugin.json'));
writeFileSync(
  identity,
  JSON.stringify({
    originalManifest,
    runtimeSha256,
  }),
);
const requests = () => JSON.parse(readFileSync(control, 'utf8')).requests as number;
const reset = (untrusted = 1) => {
  writeFileSync(control, JSON.stringify({ requests: 0, untrusted }));
};
const pending = () => vi.spyOn(console, 'log').mockImplementation(() => {});
const descriptor = (message: unknown) => {
  expect(message).toEqual(expect.stringContaining('CODEX_NATIVE_TRUST_PENDING '));
  return JSON.parse(String(message).slice('CODEX_NATIVE_TRUST_PENDING '.length));
};
class QualificationActor extends CodexInternalWorkflowActor {
  constructor(deadline: number) {
    const file = path.join(root, 'fixture.json');
    writeFileSync(
      file,
      JSON.stringify({
        ...fixture,
        normalTrustQualification: true,
        trustDeadline: deadline,
        hookManifestSha256: originalManifest,
        packageManifestSha256,
      }),
    );
    super(file, identity);
    this.installed = path.join(this.profile, 'plugins/cache/child');
    cpSync(installedPath, this.installed, { recursive: true });
  }
  review() {
    return this.requirePreparedTrust(installedPath);
  }
}
afterEach(() => vi.restoreAllMocks());
afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

it('gives A and later B a full fixed window from their actual untrusted announcements', async () => {
  let now = 1_000_000;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  const actor = new QualificationActor(now + 300_000);
  const log = pending();
  reset(2);
  expect(await actor.review()).toHaveLength(5);
  now += 600_000;
  reset(2);
  try {
    expect(await actor.review()).toHaveLength(5);
  } catch (error) {
    throw new Error('NORMAL_TRUST_WINDOW_UNAVAILABLE', { cause: error });
  }
  expect(log.mock.calls).toHaveLength(2);
  const A = descriptor(log.mock.calls[0]?.[0]);
  const B = descriptor(log.mock.calls[1]?.[0]);
  expect(A.trustDeadline).toBe(1_300_000);
  expect(B.trustDeadline).toBe(1_900_000);
  expect(B.root).toBe(actor.artifacts);
  expect(B.profile).toBe(A.profile);
  expect(B.installedPath).toBe(A.installedPath);
  for (const phase of ['A', 'B']) {
    const result = JSON.parse(
      readFileSync(path.join(actor.artifacts, `normal-trust-${phase}.json`), 'utf8'),
    );
    expect(result.observations.map((row: { ready: boolean }) => row.ready)).toEqual([
      false,
      false,
      true,
    ]);
  }
});

it('expires one announced qualification window without renewing on subsequent polls', async () => {
  reset(4);
  vi.spyOn(Date, 'now').mockImplementation(() => 1_000_000 + requests() * 100_000);
  const log = pending();
  await expect(
    requireCodexNativeTrust(fixture, installedPath, 99_000_000, path.join(root, 'expiry.json')),
  ).rejects.toThrow('exact prepared fixture requires native hook trust');
  expect(requests()).toBe(4);
  expect(log.mock.calls).toHaveLength(1);
  expect(descriptor(log.mock.calls[0]?.[0]).trustDeadline).toBe(1_400_000);
});

it('keeps the generic supplied deadline and pending descriptor unchanged', async () => {
  reset();
  vi.spyOn(Date, 'now').mockReturnValue(1000);
  const log = pending();
  expect(await requireCodexNativeTrust(fixture, installedPath, 2000)).toHaveLength(5);
  expect(descriptor(log.mock.calls[0]?.[0])).toEqual(fixture);
});

it('refuses an expired generic deadline without announcing a fresh window', async () => {
  reset();
  vi.spyOn(Date, 'now').mockReturnValue(2000);
  const log = pending();
  await expect(requireCodexNativeTrust(fixture, installedPath, 2000)).rejects.toThrow(
    'exact prepared fixture requires native hook trust',
  );
  expect(log).not.toHaveBeenCalled();
});

it('does not announce for already trusted inventory and still requires actual qualification refusal', async () => {
  reset(0);
  const log = pending();
  expect(await requireCodexNativeTrust(fixture, installedPath)).toHaveLength(5);
  await expect(
    requireCodexNativeTrust(fixture, installedPath, undefined, path.join(root, 'trusted.json')),
  ).rejects.toThrow('normal trust qualification observed no initial refusal');
  expect(log).not.toHaveBeenCalled();
});
