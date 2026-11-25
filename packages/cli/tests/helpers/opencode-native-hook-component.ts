import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import { pathToFileURL } from 'node:url';

import hostReleases from '../../src/lifecycle/host-releases.json' with { type: 'json' };
import { OPENCODE_V2_PLUGIN_LAYOUT as layout } from '../../src/schema.js';
import { VERSION } from '../../src/version.js';

/** Real SDK entry/guard; only the external OS parent observation is substituted. */
export function installNativeHookComponent(root: string, candidate: string): void {
  symlinkSync(
    nodePath.resolve('../opencode-v2-plugin/node_modules'),
    nodePath.join(root, 'node_modules'),
  );
  for (const file of [layout.commands, layout.workers])
    writeFileSync(nodePath.join(candidate, file), '[]');
  const osFile = nodePath.join(root, 'native-parent.json');
  writeFileSync(
    osFile,
    JSON.stringify({
      serverExecutable: realpathSync(process.execPath),
      parentExecutable: realpathSync(process.execPath),
      serverArguments: ['serve', '--stdio', '--port', '0'],
      parentArguments: ['run', '--standalone', '--auto', 'fixture private prompt'],
    }),
  );
  const boundary = `import {readFileSync} from 'node:fs';export function readNativeParent(){return {...JSON.parse(readFileSync(${JSON.stringify(osFile)},'utf8')),serverPid:process.pid,parentPid:process.ppid}}`;
  const script = String.raw`const r=await Bun.build({entrypoints:[${JSON.stringify(nodePath.resolve('../opencode-v2-plugin/src/index.ts'))}],target:'node',format:'esm',external:['@opencode/plugin'],define:{__SAFEWORD_VERSION__:${JSON.stringify(JSON.stringify(VERSION))},__SAFEWORD_OPENCODE_LAYOUT__:${JSON.stringify(JSON.stringify(layout))}},plugins:[{name:'external-os-only',setup(b){b.onLoad({filter:/native-parent\.ts$/},()=>({loader:'ts',contents:${JSON.stringify(boundary)}}))}}]});if(!r.success)throw Error(String(r.logs));await Bun.write(${JSON.stringify(nodePath.join(candidate, layout.entry))},r.outputs[0]);`;
  const build = spawnSync('bun', ['-e', script], { encoding: 'utf8', timeout: 30_000 });
  if (build.status !== 0) throw new Error(`Native hook component build failed: ${build.stderr}`);
  mkdirSync(nodePath.dirname(nodePath.join(candidate, layout.dispatcher)), { recursive: true });
  writeFileSync(
    nodePath.join(candidate, layout.dispatcher),
    `import ${JSON.stringify(nodePath.resolve('src/opencode/dispatcher.ts'))};`,
  );
}

export async function nativeToolEvent(
  candidate: string,
  profile: string,
  project: string,
): Promise<void> {
  const module = await import(pathToFileURL(nodePath.join(candidate, layout.entry)).href);
  const plugin = module.default;
  let callback: ((event: object) => Promise<void>) | undefined;
  const editor = { list: () => [], add: () => {}, remove: () => {} };
  await plugin.setup({
    options: { profileDirectory: profile },
    location: { directory: project },
    app: { version: hostReleases.opencode.version },
    tool: {
      hook: (_: string, fn: typeof callback) => {
        callback = fn;
        return Promise.resolve();
      },
    },
    session: { hook: async () => {} },
    skill: {
      transform: (fn: (value: typeof editor) => void) => {
        fn(editor);
        return Promise.resolve({ dispose: async () => {} });
      },
    },
    command: { transform: async () => {} },
  });
  if (!callback) throw new Error('Installed native tool hook missing');
  await callback({
    tool: 'shell',
    sessionID: 'real-enrolled-session',
    input: { command: 'printf permitted > allowed-native.txt' },
  });
}

export function setNativeParentComponent(root: string, change: object): void {
  const file = nodePath.join(root, 'native-parent.json');
  const current = JSON.parse(readFileSync(file, 'utf8'));
  writeFileSync(file, JSON.stringify({ ...current, ...change }));
}
