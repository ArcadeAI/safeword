// Keep the installed package's library exports and route its executable to the arm's bundle.
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} = require('node:fs');
const { join } = require('node:path');

const [bundle, ledger] = process.argv.slice(2);
const packageSource = 'node_modules/safeword';
const projectBin = './node_modules/.bin/safeword';
const scratch = mkdtempSync('/tmp/harbor-safeword-package.');
const archive = join(bundle, 'eval-safeword.tgz');
const runtime = join(bundle, 'plugin/runtime/cli.js');
const identity = JSON.parse(readFileSync(join(bundle, 'plugin/identity.json'), 'utf8'));
const digest = createHash('sha256').update(readFileSync(runtime)).digest('hex');

function run(executable, args, options = {}) {
  const result = spawnSync(executable, args, { stdio: 'inherit', ...options });
  if (result.status !== 0) throw new Error(`Failed to run ${executable} while pinning Safeword`);
  return result.stdout;
}

try {
  const shim = `#!/usr/bin/env node
const { spawnSync } = process.getBuiltinModule('node:child_process');
const result = spawnSync('bun', [${JSON.stringify(runtime)}, ...process.argv.slice(2)], {stdio: 'inherit'});
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
`;
  if (existsSync(join(packageSource, 'package.json'))) {
    const packagePath = join(scratch, 'package');
    cpSync(realpathSync(packageSource), packagePath, { recursive: true });
    const manifestFile = join(packagePath, 'package.json');
    const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
    manifest.bin = { safeword: 'harbor-cli.cjs' };
    writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
    writeFileSync(join(packagePath, manifest.bin.safeword), shim, { mode: 0o755 });
    run('tar', ['-czf', archive, '-C', scratch, 'package']);
    if (existsSync('package-lock.json') && !existsSync('bun.lock') && !existsSync('bun.lockb')) {
      run('npm', ['install', '--save-dev', '--ignore-scripts', '--no-audit', '--no-fund', archive]);
    } else {
      run('bun', ['add', '-D', '--ignore-scripts', archive]);
    }
  } else {
    mkdirSync('./node_modules/.bin', { recursive: true });
    writeFileSync(projectBin, shim, { mode: 0o755 });
  }
  const options = { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' };
  const version = run('bun', [runtime, '--version'], options).trim();
  const projectVersion = run(projectBin, ['--version'], options).trim();
  const installedBin = readFileSync(realpathSync(projectBin), 'utf8');
  if (projectVersion !== version || !installedBin.includes(runtime)) {
    throw new Error('The project CLI does not resolve to the arm runtime');
  }
  writeFileSync(
    ledger,
    JSON.stringify(
      {
        version,
        runtime,
        sha256: digest,
        plugin_version: identity.plugin_version,
        inventory_sha256: identity.inventory_sha256,
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
