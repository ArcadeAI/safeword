import nodePath from 'node:path';

import { VERSION } from '../version.js';
import { readFileSafe, readJson, writeFile } from './fs.js';
import { installDependencies } from './install.js';

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

const DEPENDENCY_FIELDS = ['devDependencies', 'dependencies', 'optionalDependencies'] as const;
const SAFEWORD_REGISTRY_SPEC = `^${VERSION}`;
const SAFEWORD_INSTALL_SPEC = VERSION;
const NON_REGISTRY_SPEC_PREFIXES = [
  'file:',
  'link:',
  'portal:',
  'workspace:',
  'git+',
  'github:',
  'gitlab:',
  'bitbucket:',
  'http:',
  'https:',
  '.',
  '/',
] as const;

// Ticket 154: strip the inert `version` field from .safeword/config.json.
// Plaintext `.safeword/version` is the source of truth.
export function stripDeadConfigVersion(safewordDirectory: string): boolean {
  const configPath = nodePath.join(safewordDirectory, 'config.json');
  const content = readFileSafe(configPath);
  if (!content) return false;
  const parsed = JSON.parse(content) as Record<string, unknown>;
  if (!('version' in parsed)) return false;
  delete parsed.version;
  writeFile(configPath, JSON.stringify(parsed, undefined, 2));
  return true;
}

function isNonRegistryPackageSpec(spec: string): boolean {
  return NON_REGISTRY_SPEC_PREFIXES.some(prefix => spec.startsWith(prefix));
}

function isCurrentSafewordRegistrySpec(spec: string): boolean {
  return [VERSION, SAFEWORD_REGISTRY_SPEC, `~${VERSION}`].includes(spec);
}

export function syncPackageJsonSafewordVersion(
  cwd: string,
  options: { report?: boolean } = {},
): boolean {
  const packageJson = readPackageJson(cwd);
  if (!packageJson) return false;

  for (const field of DEPENDENCY_FIELDS) {
    const dependencies = packageJson[field];
    const currentSpec = dependencies?.safeword;
    if (!dependencies || currentSpec === undefined || isNonRegistryPackageSpec(currentSpec))
      continue;

    if (isCurrentSafewordRegistrySpec(currentSpec)) continue;
    installDependencies(cwd, [`safeword@${SAFEWORD_INSTALL_SPEC}`], 'safeword package', options);
    return packageJsonReferencesCurrentSafewordVersion(cwd);
  }

  return false;
}

function readPackageJson(cwd: string): PackageJson | undefined {
  return readJson(nodePath.join(cwd, 'package.json')) as PackageJson | undefined;
}

function packageJsonReferencesCurrentSafewordVersion(cwd: string): boolean {
  const packageJson = readPackageJson(cwd);
  return DEPENDENCY_FIELDS.some(field => {
    const spec = packageJson?.[field]?.safeword;
    return spec !== undefined && isCurrentSafewordRegistrySpec(spec);
  });
}
