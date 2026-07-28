import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { type CliResult, createResult, type Effect } from '../cli-protocol/result.js';
import { installPack } from '../packs/install.js';
import { getMissingPacks } from '../packs/registry.js';
import { reconcile, ReconcileExecutionError, type ReconcileResult } from '../reconcile.js';
import { SAFEWORD_SCHEMA } from '../schema.js';
import { createProjectContext } from '../utils/context.js';
import { exists, writeJson } from '../utils/fs.js';
import { type DependencyInstallResult, installDependencies } from '../utils/install.js';
import {
  applyVendoredIgnoresPolicy,
  type VendoredIgnoresPolicyResult,
} from '../utils/vendored-ignores-nudge.js';
import { compareVersions } from '../utils/version.js';
import { VERSION } from '../version.js';
import { effectsForReconciliation } from './reconciliation-plan.js';
import {
  buildArchitecture,
  hasArchitectureDetected,
  inspectConfig,
  syncConfigCore,
} from './sync-config.js';
import { stripDeadConfigVersion, syncPackageJsonSafewordVersion } from './upgrade.js';

function ensurePackageJson(cwd: string): boolean {
  const packageJsonPath = nodePath.join(cwd, 'package.json');
  if (exists(packageJsonPath)) return false;
  writeJson(packageJsonPath, {
    name: nodePath.basename(cwd) || 'project',
    version: '0.1.0',
    private: true,
    scripts: {},
  });
  return true;
}

function configureArchitecture(cwd: string): Effect[] {
  const context = createProjectContext(cwd);
  if (!context.projectType.hasJsSource) return [];
  const architecture = buildArchitecture(cwd);
  if (!hasArchitectureDetected(architecture)) return [];
  const before = inspectConfig(cwd, architecture);
  const result = syncConfigCore(cwd, architecture);
  return [
    ...(result.generatedConfig
      ? [
          {
            kind: before.matches ? 'update' : 'create',
            target: '.safeword/depcruise-config.cjs',
          },
        ]
      : []),
    ...(result.createdMainConfig ? [{ kind: 'create', target: '.dependency-cruiser.cjs' }] : []),
  ];
}

function partialSetupFailure(setupError: ReconcileExecutionError): CliResult {
  const files = [
    ...setupError.partial.created.map(target => ({ kind: 'create', target })),
    ...setupError.partial.updated.map(target => ({ kind: 'update', target })),
  ];
  return createResult({
    state: 'failed',
    changed: files.length > 0,
    effects: { files },
    errors: [
      {
        code: 'SETUP_FAILED',
        message: setupError.message,
        retryable: true,
      },
    ],
    recovery: [
      {
        command: 'safeword status --verbose',
        description: 'Inspect the partial project state before retrying setup.',
        requiresHuman: true,
      },
    ],
  });
}

export async function convergeSetup(
  cwd: string,
  options: {
    noModify?: boolean;
    progress?: {
      readonly start: (message: string) => void;
      readonly stop: () => void;
    };
  },
): Promise<CliResult> {
  const configured = existsSync(nodePath.join(cwd, '.safeword'));
  const downgrade = configured ? downgradeRefusal(cwd) : undefined;
  if (downgrade !== undefined) return downgrade;
  const packageJsonCreated = configured ? false : ensurePackageJson(cwd);

  try {
    options.progress?.start(
      configured ? 'Reconciling the Safeword upgrade…' : 'Setting up Safeword…',
    );
    return await applySetup(cwd, configured, packageJsonCreated, options.noModify === true);
  } catch (setupError) {
    return setupFailure(setupError);
  }
}

function downgradeRefusal(cwd: string): CliResult | undefined {
  const projectVersionPath = nodePath.join(cwd, '.safeword', 'version');
  const projectVersion = exists(projectVersionPath)
    ? readFileSync(projectVersionPath, 'utf8').trim()
    : '0.0.0';
  if (compareVersions(VERSION, projectVersion) >= 0) return undefined;
  return createResult({
    state: 'failed',
    errors: [
      {
        code: 'CLI_DOWNGRADE_REFUSED',
        message: `CLI v${VERSION} is older than project v${projectVersion}. Update the CLI first.`,
        retryable: false,
      },
    ],
  });
}

function packageFindings(installation: DependencyInstallResult) {
  if (!installation.attempted || installation.installed) return [];
  return [
    {
      code: 'PACKAGE_INSTALL_FAILED',
      message: `Package installation failed. Run: ${installation.command ?? 'your package manager install command'}`,
      severity: 'warning' as const,
    },
  ];
}

function gitFindings(gitInitialized: boolean) {
  if (gitInitialized) return [];
  return [
    {
      code: 'GIT_NOT_INITIALIZED',
      message: 'Git initialization was skipped because this directory is not a Git repository.',
      severity: 'info' as const,
    },
  ];
}

function eslintFindings(eslintPolicy: VendoredIgnoresPolicyResult) {
  if (eslintPolicy.kind !== 'manual') return [];
  return [
    {
      code: 'ESLINT_MANUAL_CONFIGURATION_REQUIRED',
      message: 'Add safeword.configs.vendoredIgnores to the existing ESLint configuration.',
      severity: 'warning' as const,
    },
  ];
}

interface SetupResultInput {
  readonly cwd: string;
  readonly reconciliation: ReconcileResult;
  readonly packageJsonCreated: boolean;
  readonly architectureEffects: Effect[];
  readonly installation: DependencyInstallResult;
  readonly eslintPolicy: VendoredIgnoresPolicyResult;
  readonly compatibilityEffects: Effect[];
  readonly compatibilityPackage?: string;
  readonly gitInitialized: boolean;
}

function uniqueEffects(effects: readonly Effect[]): Effect[] {
  const seen = new Set<string>();
  return effects.filter(effect => {
    const identity = `${effect.kind}\0${effect.target}\0${effect.operation ?? ''}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

function setupResult(input: SetupResultInput): CliResult {
  const {
    cwd,
    reconciliation,
    packageJsonCreated,
    architectureEffects,
    installation,
    eslintPolicy,
    compatibilityEffects,
    compatibilityPackage,
    gitInitialized,
  } = input;
  const reconciled = effectsForReconciliation(reconciliation, 'upgrade');
  const files = uniqueEffects([
    ...(packageJsonCreated ? [{ kind: 'create', target: 'package.json' }] : []),
    ...reconciled.files,
    ...architectureEffects,
    ...compatibilityEffects,
    ...(eslintPolicy.kind === 'patched'
      ? [
          {
            kind: 'update',
            target: nodePath.relative(cwd, eslintPolicy.configPath),
          },
          {
            kind: 'create',
            target: nodePath.relative(cwd, eslintPolicy.backupPath),
          },
        ]
      : []),
  ]);
  const packages = [
    ...(installation.installed
      ? reconciliation.packagesToInstall.map(target => ({ kind: 'install', target }))
      : []),
    ...(compatibilityPackage === undefined
      ? []
      : [{ kind: 'update', target: compatibilityPackage }]),
  ];
  const network = packages.map(effect => ({
    kind: 'package-registry',
    target: effect.target,
    operation: effect.kind,
  }));
  const changed = files.length > 0 || packages.length > 0;
  const findings = [
    ...packageFindings(installation),
    ...gitFindings(gitInitialized),
    ...eslintFindings(eslintPolicy),
  ];
  const actionRequired = findings.some(finding => finding.severity !== 'info');
  let state: CliResult['state'] = changed ? 'changed' : 'healthy';
  if (actionRequired) state = 'action_required';
  const nextCommand = actionRequired
    ? (installation.command ?? 'safeword setup')
    : 'safeword codex install';
  return createResult({
    state,
    changed,
    effects: { files, packages, network },
    findings,
    nextActions: [{ command: nextCommand, mutates: true, requiresHuman: true }],
    data: { configured: true, dependency_install: installation },
  });
}

async function applySetup(
  cwd: string,
  configured: boolean,
  packageJsonCreated: boolean,
  noModify: boolean,
): Promise<CliResult> {
  const context = createProjectContext(cwd);
  const result = await reconcile(SAFEWORD_SCHEMA, configured ? 'upgrade' : 'install', context);
  const missingPacks = getMissingPacks(cwd);
  const compatibilityEffects = missingPacks.flatMap(packId =>
    installPack(packId, cwd).files.map(target => ({ kind: 'create', target })),
  );
  if (missingPacks.length > 0) {
    compatibilityEffects.push({ kind: 'update', target: '.safeword/config.json' });
  }
  if (stripDeadConfigVersion(nodePath.join(cwd, '.safeword'))) {
    compatibilityEffects.push({ kind: 'update', target: '.safeword/config.json' });
  }
  const architectureEffects = configureArchitecture(cwd);
  const eslintPolicy = applyVendoredIgnoresPolicy({
    cwd,
    existingEslintConfig: context.projectType.existingEslintConfig,
    hasJavaScript: context.languages?.javascript ?? false,
    noModify,
  });
  const installation = installDependencies(cwd, result.packagesToInstall, 'missing packages', {
    report: false,
  });
  const compatibilityPackage = syncPackageJsonSafewordVersion(cwd, { report: false })
    ? `safeword@${VERSION}`
    : undefined;
  if (compatibilityPackage !== undefined) {
    compatibilityEffects.push({ kind: 'update', target: 'package.json' });
  }
  return setupResult({
    cwd,
    reconciliation: result,
    packageJsonCreated,
    architectureEffects,
    installation,
    eslintPolicy,
    compatibilityEffects,
    compatibilityPackage,
    gitInitialized: context.isGitRepo,
  });
}

function setupFailure(setupError: unknown): CliResult {
  if (setupError instanceof ReconcileExecutionError) return partialSetupFailure(setupError);
  return createResult({
    state: 'failed',
    errors: [
      {
        code: 'SETUP_FAILED',
        message: setupError instanceof Error ? setupError.message : String(setupError),
        retryable: true,
      },
    ],
    recovery: [
      {
        command: 'safeword status --verbose',
        description: 'Inspect the partial project state before retrying setup.',
        requiresHuman: true,
      },
    ],
  });
}
