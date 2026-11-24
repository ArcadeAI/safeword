import { execFileSync } from 'node:child_process';
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
import path from 'node:path';

export const electronRequest = {
  ticketId: 'SGWMBS',
  scenario: 'A differently cased soul suffix opens as a package',
  testFile: 'packages/desktop/tests/electron/89-soul-cased-suffix.electron.spec.ts',
  testLine: 8,
  testFullName:
    ' 89-soul-cased-suffix.electron.spec.ts A differently cased soul suffix opens as a package',
  implementationPath: 'packages/desktop/src/renderer/src/services/tabLifecycle.ts',
  mutation: {
    before: 'behavior = true',
    after: 'behavior = false',
    expectedFailure: 'expected retained package behavior',
    assertionLocation: 'packages/desktop/tests/electron/89-soul-cased-suffix.electron.spec.ts:39',
  },
  supportFiles: ['packages/desktop/playwright-electron.config.ts'],
};

/** Controlled external tools exercise archive/process wiring; these are not Electron acceptance evidence. */
export function electronRunnerFixture() {
  const temporaryPath = mkdtempSync(path.join(tmpdir(), 'safeword-electron-runner-'));
  const temporary = realpathSync.native(temporaryPath);
  const root = path.join(temporary, 'repository');
  const bin = path.join(temporary, 'tools');
  const log = path.join(temporary, 'processes.jsonl');
  const requestPath = '.project/tickets/SGWMBS-open-save-soul-electron/proof.request.json';
  const write = (relative: string, contents: string) => {
    const target = path.join(root, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, contents);
  };
  write('package.json', JSON.stringify({ packageManager: 'pnpm@11.7.0' }));
  write('pnpm-lock.yaml', 'lockfileVersion: 9.0\n');
  write('pnpm-workspace.yaml', 'packages: [packages/desktop]\n');
  write('packages/desktop/package.json', JSON.stringify({ name: '@soulless/desktop' }));
  write(electronRequest.implementationPath, 'export const behavior = true;\n');
  if (process.platform !== 'win32') {
    write('packages/desktop/src/renderer/src/stores/state.ts', 'export const state = {};\n');
    symlinkSync('renderer/src/services', path.join(root, 'packages/desktop/src/services'));
    symlinkSync('renderer/src/stores', path.join(root, 'packages/desktop/src/stores'));
  }
  write(electronRequest.testFile, `${'\n'.repeat(7)}// selected fixture declaration\n`);
  write(electronRequest.supportFiles[0] ?? '', 'export default {};\n');
  write(requestPath, JSON.stringify(electronRequest));
  const git = (...args: string[]) =>
    execFileSync('git', ['-C', root, ...args], {
      encoding: 'utf8',
      env: Object.fromEntries(
        Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')),
      ),
    }).trim();
  git('init', '-q');
  git('config', 'user.name', 'Test');
  git('config', 'user.email', 'test@example.com');
  git('config', 'commit.gpgsign', 'false');
  git('add', '.');
  git('commit', '-qm', 'committed Electron fixture');
  mkdirSync(bin);
  const playwright = String.raw`
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(process.cwd(), '../..');
const args = process.argv.slice(2);
const grep = args[args.indexOf('--grep')+1];
const pattern = new RegExp(grep.slice(1,-1));
const requestDirectory = path.join(root, ${JSON.stringify(path.dirname(requestPath))});
const requests = fs.readdirSync(requestDirectory).filter(file=>file.endsWith('.request.json')).map(file=>JSON.parse(fs.readFileSync(path.join(requestDirectory,file),'utf8'))).filter(request=>pattern.test(request.testFullName));
if (requests.length !== 1) process.exit(74);
const request = requests[0];
const source = fs.readFileSync(path.join(root, request.implementationPath), 'utf8');
if (fs.readFileSync(path.join(root, 'node_modules/installed-for'), 'utf8') !== root) process.exit(71);
if (fs.readFileSync('out/main/index.js', 'utf8') !== source) process.exit(72);
if (fs.existsSync(path.join(root, 'untracked-poison'))) process.exit(73);
if (!args.includes('--workers=1') || !args.includes('--retries=0') || !args.includes('--repeat-each=1') || !args.includes('--no-deps') || !args.includes('--forbid-only')) process.exit(74);
fs.appendFileSync(process.env.SAFEWORD_ELECTRON_FIXTURE_LOG, JSON.stringify({event:'test', root, source, scenario:request.scenario, port:process.env.SOULLESS_ELECTRON_TEST_PORT, profile:process.env.TMPDIR})+'\n');
const mutated = process.env.SAFEWORD_ELECTRON_FIXTURE_MODE !== 'surviving-mutation' && source.includes('behavior = false');
const failure = 'Error: expect(received).toEqual(expected)\nExpected: '+request.mutation.expectedFailure+'\nReceived: missing package behavior\n    at '+request.mutation.assertionLocation+':3';
const result = {status:mutated?'failed':'passed',retry:0,annotations:[],errors:mutated?[{message:failure,location:{file:path.join(root,request.testFile),line:39,column:3}}]:[]};
const report = {config:{projects:[{id:'',name:'',repeatEach:1,retries:0}]},suites:[{title:path.basename(request.testFile),specs:[{title:request.scenario,file:path.basename(request.testFile),line:request.testLine,tests:[{projectId:'',projectName:'',expectedStatus:'passed',status:mutated?'unexpected':'expected',annotations:[],results:[result]}]}],suites:[]}],errors:[],stats:{expected:mutated?0:1,unexpected:mutated?1:0,flaky:0,skipped:0}};
if (process.env.SAFEWORD_ELECTRON_FIXTURE_MODE === 'occupied-port') {
  const net = require('node:net');
  const owner = net.createServer();
  owner.listen(Number(process.env.SOULLESS_ELECTRON_TEST_PORT),'127.0.0.1',()=>{
    const renderer=net.createServer();
    renderer.once('error',error=>{
      report.suites=[];report.stats={expected:0,unexpected:0,flaky:0,skipped:0};
      report.errors=[{message:'Owned renderer port collision: '+error.code}];
      fs.writeFileSync(process.env.PLAYWRIGHT_JSON_OUTPUT_FILE,JSON.stringify(report));
      fs.appendFileSync(process.env.SAFEWORD_ELECTRON_FIXTURE_LOG,JSON.stringify({event:'port-refused',root,code:error.code})+'\n');
      owner.close(()=>process.exit(1));
    });
    renderer.listen(Number(process.env.SOULLESS_ELECTRON_TEST_PORT),'127.0.0.1');
  });
} else {
  fs.writeFileSync(process.env.PLAYWRIGHT_JSON_OUTPUT_FILE, JSON.stringify(report));
  process.exit(mutated?1:0);
}
`;
  const pnpm = String.raw`#!${process.execPath}
const fs = require('node:fs');
const path = require('node:path');
if (path.basename(process.argv[1]) !== 'pnpm') { console.error('invoke the pnpm shim, not its multi-call target'); process.exit(77); }
const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--version') { console.log('11.7.0'); process.exit(0); }
const root = process.cwd();
const event = args[0] === 'install' ? 'install' : 'build';
fs.appendFileSync(process.env.SAFEWORD_ELECTRON_FIXTURE_LOG, JSON.stringify({event,root,args})+'\n');
const mode = process.env.SAFEWORD_ELECTRON_FIXTURE_MODE;
if (mode === event+'-failure') { console.error('controlled '+event+' failure'); process.exit(23); }
if (event === 'install') {
  if (JSON.stringify(args) !== JSON.stringify(['install','--frozen-lockfile'])) process.exit(75);
  fs.mkdirSync('node_modules/playwright', {recursive:true});
  fs.writeFileSync('node_modules/installed-for', root);
  fs.writeFileSync('node_modules/playwright/cli.js', ${JSON.stringify(playwright)});
  if (mode === 'lock-drift') fs.appendFileSync('pnpm-lock.yaml', 'changed by installation\n');
  process.exit(0);
}
if (JSON.stringify(args) !== JSON.stringify(['--filter','@soulless/desktop','run','build'])) process.exit(76);
const source = fs.readFileSync(${JSON.stringify(electronRequest.implementationPath)}, 'utf8');
for (const file of ['main/index.js','preload/index.cjs','renderer/index.html']) {
  const target = path.join('packages/desktop/out',file);
  fs.mkdirSync(path.dirname(target), {recursive:true}); fs.writeFileSync(target,source);
}
`;
  writeFileSync(path.join(bin, 'multi-call-tool'), pnpm, { mode: 0o755 });
  if (process.platform !== 'win32') symlinkSync('multi-call-tool', path.join(bin, 'pnpm'));
  return {
    temporary,
    root,
    bin,
    requestPath,
    git,
    write,
    events: () =>
      readFileSync(log, 'utf8')
        .trim()
        .split('\n')
        .map(
          line =>
            JSON.parse(line) as {
              event: string;
              root: string;
              args?: string[];
              source?: string;
              port?: string;
              profile?: string;
              scenario?: string;
              code?: string;
            },
        ),
    environment: {
      PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}`,
      SAFEWORD_ELECTRON_FIXTURE_LOG: log,
    },
    cleanup: () => {
      rmSync(temporary, { force: true, recursive: true });
    },
  };
}
