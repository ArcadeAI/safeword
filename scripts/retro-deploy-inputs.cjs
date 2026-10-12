const { execFileSync } = require('node:child_process');
const { appendFileSync } = require('node:fs');

const zeroSha = '0'.repeat(40);
const sharedInputs = new Set(['package.json', 'tsconfig.json', '.dockerignore', 'railway.json']);
const serviceInputs = {
  relay: {
    prefixes: ['packages/retro-relay/'],
    files: new Set(['packages/website/package.json', '.github/workflows/deploy-retro-relay.yml']),
    cliManifest: true,
  },
  collector: {
    prefixes: ['packages/retro-collector/'],
    files: new Set([
      'packages/website/package.json',
      '.github/workflows/deploy-retro-collector.yml',
    ]),
    cliManifest: true,
  },
  worker: {
    prefixes: ['packages/retro-collector/', 'packages/retro-relay/'],
    files: new Set(['.github/workflows/deploy-retro-worker.yml']),
    cliManifest: false,
  },
};

function cliManifestVersionOnly(before, after) {
  try {
    const previous = JSON.parse(before);
    const current = JSON.parse(after);
    if (previous.version === current.version) return false;
    delete previous.version;
    delete current.version;
    return JSON.stringify(previous) === JSON.stringify(current);
  } catch {
    return false;
  }
}

function lockVersionOnly(before, after) {
  const cliVersion =
    /("packages\/cli"\s*:\s*\{\s*"name"\s*:\s*"safeword"\s*,\s*"version"\s*:\s*")([^"]+)(")/u;
  const previous = cliVersion.exec(before);
  const current = cliVersion.exec(after);
  if (!previous || !current || previous[2] === current[2]) return false;
  return before.replace(cliVersion, '$1<version>$3') === after.replace(cliVersion, '$1<version>$3');
}

function shouldDeploy(service, changedFiles, readVersions) {
  const inputs = serviceInputs[service];
  if (!inputs) throw new Error(`Unknown retro service: ${service}`);
  return changedFiles.some(file => {
    if (file === 'bun.lock') {
      const [before, after] = readVersions(file);
      return !lockVersionOnly(before, after);
    }
    if (file === 'packages/cli/package.json') {
      if (!inputs.cliManifest) return false;
      const [before, after] = readVersions(file);
      return !cliManifestVersionOnly(before, after);
    }
    return (
      sharedInputs.has(file) ||
      inputs.files.has(file) ||
      inputs.prefixes.some(prefix => file.startsWith(prefix))
    );
  });
}

function main() {
  const [service, before, sha] = process.argv.slice(2);
  const output = process.env.GITHUB_OUTPUT;
  if (!serviceInputs[service] || !output || !/^[0-9a-f]{40}$/u.test(sha)) {
    throw new Error('Expected a retro service, commit SHA, and GITHUB_OUTPUT.');
  }
  let deploy = false;
  if (process.env.GITHUB_REF === 'refs/heads/main' && before) {
    if (before === zeroSha) deploy = true;
    else {
      if (!/^[0-9a-f]{40}$/u.test(before)) throw new Error('Invalid previous commit SHA.');
      execFileSync('git', ['fetch', '--no-tags', '--depth=1', 'origin', before], {
        stdio: 'inherit',
      });
      const changedFiles = execFileSync('git', ['diff', '--name-only', '-z', before, sha])
        .toString('utf8')
        .split('\0')
        .filter(Boolean);
      deploy = shouldDeploy(service, changedFiles, file =>
        [before, sha].map(ref => {
          try {
            return execFileSync('git', ['show', `${ref}:${file}`], { encoding: 'utf8' });
          } catch {
            return '';
          }
        }),
      );
    }
  }
  appendFileSync(output, `deploy=${deploy}\n`);
}

if (require.main === module) main();

module.exports = { shouldDeploy };
