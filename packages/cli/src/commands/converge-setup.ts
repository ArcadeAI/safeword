import { existsSync, lstatSync, readdirSync, readFileSync, readlinkSync } from 'node:fs';
import nodePath from 'node:path';

import { diffFileSnapshots } from '../cli-protocol/file-effects.js';
import { effectsForReconciliation } from '../cli-protocol/reconciliation.js';
import {
  type CliResult,
  createResult,
  type Effect,
  type Effects,
  type Finding,
} from '../cli-protocol/result.js';
import { checkHealth, type HealthStatus } from '../health.js';
import { installPack } from '../packs/install.js';
import { hasImportLinterScaffoldTarget } from '../packs/python/files.js';
import {
  detectPythonPackageManager,
  getPythonInstallCommand,
  getPythonTools,
  hasRuffDependency,
  installPythonDependencies,
} from '../packs/python/setup.js';
import { getMissingPacks } from '../packs/registry.js';
import { reconcile, ReconcileExecutionError, type ReconcileResult } from '../reconcile.js';
import { SAFEWORD_SCHEMA } from '../schema.js';
import { createProjectContext } from '../utils/context.js';
import { exists, writeJson } from '../utils/fs.js';
import { hookIntegrationNudge } from '../utils/hook-nudge.js';
import { type DependencyInstallResult, installDependencies } from '../utils/install.js';
import { executeNamespaceMigration, planNamespaceMigration } from '../utils/namespace-migration.js';
import {
  stripDeadConfigVersion,
  syncPackageJsonSafewordVersion,
} from '../utils/safeword-version-sync.js';
import {
  setupWorkspaceFormatScripts,
  workspacePackageJsonTargets,
} from '../utils/setup-workspaces.js';
import { scanStaleNamespaceConfigs } from '../utils/stale-config-scan.js';
import {
  applyVendoredIgnoresPolicy,
  type VendoredIgnoresPolicyResult,
} from '../utils/vendored-ignores-nudge.js';
import { compareVersions } from '../utils/version.js';
import { VERSION } from '../version.js';
import {
  buildArchitecture,
  hasArchitectureDetected,
  inspectConfig,
  syncConfigCore,
} from './sync-config.js';

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

interface SetupAdapters {
  readonly configureArchitecture: typeof configureArchitecture;
  readonly configureWorkspaces: typeof setupWorkspaceFormatScripts;
  readonly configurePython: typeof configurePython;
  readonly executeNamespaceMigration: typeof executeNamespaceMigration;
}

const DEFAULT_SETUP_ADAPTERS: SetupAdapters = {
  configureArchitecture,
  configureWorkspaces: setupWorkspaceFormatScripts,
  configurePython,
  executeNamespaceMigration,
};

interface PythonSetupResult {
  readonly tools: readonly string[];
  readonly command?: string;
  readonly attempted: boolean;
  readonly installed: boolean;
}

function configurePython(
  cwd: string,
  context: ReturnType<typeof createProjectContext>,
): PythonSetupResult {
  if (!context.languages?.python || hasRuffDependency(cwd)) {
    return { tools: [], attempted: false, installed: false };
  }
  const tools = getPythonTools(hasImportLinterScaffoldTarget(cwd));
  const command = getPythonInstallCommand(cwd, tools);
  const shouldInstall =
    !process.env.SAFEWORD_SKIP_INSTALL && detectPythonPackageManager(cwd) !== 'pip';
  if (!shouldInstall) {
    return { tools, command, attempted: false, installed: false };
  }
  return {
    tools,
    command,
    attempted: true,
    installed: installPythonDependencies(cwd, [...tools]),
  };
}

class SetupApplyError extends Error {
  readonly completedEffects: Partial<Effects>;

  constructor(cause: unknown, completedEffects: Partial<Effects>) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
    this.name = 'SetupApplyError';
    this.completedEffects = completedEffects;
  }
}

export async function convergeSetup(
  cwd: string,
  options: {
    noModify?: boolean;
    migrateNamespace?: boolean;
    progress?: {
      readonly start: (message: string) => void;
      readonly stop: () => void;
    };
    adapters?: Partial<SetupAdapters>;
  },
): Promise<CliResult> {
  const configured = existsSync(nodePath.join(cwd, '.safeword'));
  const downgrade = configured ? downgradeRefusal(cwd) : undefined;
  if (downgrade !== undefined) return downgrade;
  let namespaceMigration: NamespaceConvergence = { effects: [], findings: [] };
  let packageJsonCreated = false;

  try {
    const adapters = {
      ...DEFAULT_SETUP_ADAPTERS,
      ...options.adapters,
    };
    const namespaceTargets = ['.safeword-project', '.project', '.safeword/config.json'];
    const namespaceBefore = snapshotFiles(cwd, namespaceTargets);
    namespaceMigration = convergeNamespace(
      cwd,
      options.migrateNamespace,
      adapters.executeNamespaceMigration,
    );
    namespaceMigration = {
      ...namespaceMigration,
      effects: uniqueEffects([
        ...namespaceMigration.effects,
        ...diffFileSnapshots(namespaceBefore, snapshotFiles(cwd, namespaceTargets)),
      ]),
    };
    packageJsonCreated = configured ? false : ensurePackageJson(cwd);
    options.progress?.start(
      configured ? 'Reconciling the Safeword upgrade…' : 'Setting up Safeword…',
    );
    return await applySetup(cwd, {
      configured,
      packageJsonCreated,
      noModify: options.noModify === true,
      namespaceMigration,
      adapters,
    });
  } catch (setupError) {
    return setupFailure(setupError, {
      files: [
        ...(packageJsonCreated ? [{ kind: 'create', target: 'package.json' }] : []),
        ...namespaceMigration.effects,
      ],
    });
  }
}

interface NamespaceConvergence {
  readonly effects: Effect[];
  readonly findings: Finding[];
}

function convergeNamespace(
  cwd: string,
  migrate: boolean | undefined,
  migrateNamespace: typeof executeNamespaceMigration,
): NamespaceConvergence {
  const plan = planNamespaceMigration(cwd);
  if (plan !== 'offer') {
    const messages: Partial<Record<typeof plan, string>> = {
      'both-dirs':
        'Namespace migration skipped: .project/ already exists alongside .safeword-project/.',
      blocked: 'Namespace migration skipped: .project exists but is not a directory.',
    };
    const message = migrate === true ? messages[plan] : undefined;
    return {
      effects: [],
      findings:
        message === undefined
          ? []
          : [{ code: 'NAMESPACE_MIGRATION_BLOCKED', message, severity: 'warning' }],
    };
  }
  if (migrate !== true) {
    return {
      effects: [],
      findings:
        migrate === false
          ? []
          : [
              {
                code: 'NAMESPACE_MIGRATION_AVAILABLE',
                message:
                  'This project still uses .safeword-project; run `safeword setup --migrate-namespace` to move it to .project.',
                severity: 'info',
              },
            ],
    };
  }
  try {
    migrateNamespace(cwd);
    const staleConfigs = scanStaleNamespaceConfigs(cwd);
    return {
      effects: [{ kind: 'move', target: '.safeword-project → .project' }],
      findings: [
        {
          code: 'NAMESPACE_MIGRATED',
          message: 'Project namespace moved to .project.',
          severity: 'info',
        },
        ...staleConfigs.map(target => ({
          code: 'STALE_NAMESPACE_REFERENCE',
          message: `${target} still references the old namespace (.safeword-project/ → .project/).`,
          severity: 'warning' as const,
        })),
      ],
    };
  } catch (migrationError) {
    return {
      effects: [],
      findings: [
        {
          code: 'NAMESPACE_MIGRATION_FAILED',
          message:
            migrationError instanceof Error ? migrationError.message : String(migrationError),
          severity: 'warning',
        },
      ],
    };
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

function setupGuidanceFindings(
  context: ReturnType<typeof createProjectContext>,
  reconciliation: ReconcileResult,
  architectureEffects: readonly Effect[],
) {
  const findings: Finding[] = [];
  if (architectureEffects.length > 0) {
    findings.push({
      code: 'ARCHITECTURE_DETECTED',
      message: 'Architecture detected; project-structure checks are configured.',
      severity: 'info',
      detail: architectureEffects.some(effect => effect.target === '.dependency-cruiser.cjs')
        ? '.dependency-cruiser.cjs extends rules from .safeword/depcruise-config.cjs; edit the wrapper to add project rules.'
        : undefined,
    });
  }
  const hookNudge = hookIntegrationNudge(context);
  if (hookNudge !== undefined) {
    findings.push({
      code: 'BOUNDARY_GATE_INTEGRATION_AVAILABLE',
      message: 'Boundary-gate hook integration is available; use --verbose for the exact snippet.',
      severity: 'info' as const,
      detail: hookNudge,
    });
  }
  if (context.languages?.golang && reconciliation.created.includes('.golangci.yml')) {
    findings.push({
      code: 'GO_TOOLS_AVAILABLE',
      message: 'Go tooling: go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest',
      severity: 'info' as const,
    });
  }
  if (context.projectType.existingFormatter) {
    findings.push({
      code: 'EXISTING_FORMATTER_PRESERVED',
      message: 'Existing formatter detected; Safeword left it unchanged.',
      severity: 'info' as const,
    });
  }
  if (!context.projectType.scaffoldBddLane && context.projectType.existingCucumberHarness) {
    findings.push({
      code: 'EXISTING_CUCUMBER_HARNESS_PRESERVED',
      message: `Existing Cucumber harness preserved (${context.projectType.existingCucumberHarness}).`,
      severity: 'info' as const,
    });
  }
  return findings;
}

interface SetupResultInput {
  readonly cwd: string;
  readonly reconciliation: ReconcileResult;
  readonly packageJsonCreated: boolean;
  readonly architectureEffects: Effect[];
  readonly workspaceEffects: Effect[];
  readonly installation: DependencyInstallResult;
  readonly eslintPolicy: VendoredIgnoresPolicyResult;
  readonly compatibilityEffects: Effect[];
  readonly compatibilityPackage?: string;
  readonly gitInitialized: boolean;
  readonly guidanceFindings: ReturnType<typeof setupGuidanceFindings>;
  readonly pythonSetup: PythonSetupResult;
  readonly namespaceMigration: NamespaceConvergence;
  readonly completedEffects: CompletedSetupEffects;
}

interface CompletedSetupEffects {
  readonly files: Effect[];
  readonly packages: Effect[];
  readonly network: Effect[];
}

function snapshotFiles(cwd: string, targets: readonly string[]): Map<string, string> {
  const snapshot = new Map<string, string>();
  const visit = (absolutePath: string): void => {
    if (!existsSync(absolutePath)) return;
    const stat = lstatSync(absolutePath);
    const relativePath = nodePath.relative(cwd, absolutePath);
    if (stat.isSymbolicLink()) {
      snapshot.set(relativePath, `link:${readlinkSync(absolutePath)}`);
      return;
    }
    if (stat.isDirectory()) {
      for (const entry of readdirSync(absolutePath)) visit(nodePath.join(absolutePath, entry));
      return;
    }
    if (stat.isFile()) snapshot.set(relativePath, readFileSync(absolutePath).toString('base64'));
  };
  for (const target of targets) {
    visit(nodePath.isAbsolute(target) ? target : nodePath.join(cwd, target));
  }
  return snapshot;
}

function observeFileStage<T>(
  cwd: string,
  targets: readonly string[],
  completedEffects: CompletedSetupEffects,
  action: () => T,
): T {
  const before = snapshotFiles(cwd, targets);
  try {
    return action();
  } finally {
    completedEffects.files.push(...diffFileSnapshots(before, snapshotFiles(cwd, targets)));
  }
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

function setupNetworkEffects(
  packages: readonly Effect[],
  installation: DependencyInstallResult,
  reconciliation: ReconcileResult,
): Effect[] {
  const effects = packages.map(effect => ({
    kind: 'package-registry',
    target: effect.target,
    operation: effect.kind,
  }));
  if (!installation.attempted || installation.installed) return effects;
  effects.push(
    ...reconciliation.packagesToInstall.map(target => ({
      kind: 'package-registry',
      target,
      operation: 'install',
    })),
  );
  return effects;
}

// eslint-disable-next-line complexity -- result assembly explicitly maps each independently observable setup effect and recovery finding
function setupResult(input: SetupResultInput): CliResult {
  const {
    cwd,
    reconciliation,
    packageJsonCreated,
    architectureEffects,
    workspaceEffects,
    installation,
    eslintPolicy,
    compatibilityEffects,
    compatibilityPackage,
    gitInitialized,
    guidanceFindings,
    pythonSetup,
    namespaceMigration,
    completedEffects,
  } = input;
  const reconciled = effectsForReconciliation(reconciliation, 'upgrade');
  const files = uniqueEffects([
    ...(packageJsonCreated ? [{ kind: 'create', target: 'package.json' }] : []),
    ...reconciled.files,
    ...architectureEffects,
    ...workspaceEffects,
    ...namespaceMigration.effects,
    ...compatibilityEffects,
    ...completedEffects.files,
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
  const packages = uniqueEffects([
    ...(installation.installed
      ? reconciliation.packagesToInstall.map(target => ({ kind: 'install', target }))
      : []),
    ...(compatibilityPackage === undefined
      ? []
      : [{ kind: 'update', target: compatibilityPackage }]),
    ...(pythonSetup.installed
      ? pythonSetup.tools.map(target => ({ kind: 'install', target }))
      : []),
    ...completedEffects.packages,
  ]);
  const network = uniqueEffects([
    ...setupNetworkEffects(packages, installation, reconciliation),
    ...(!pythonSetup.attempted || pythonSetup.installed
      ? []
      : pythonSetup.tools.map(target => ({
          kind: 'package-registry',
          target,
          operation: 'install',
        }))),
    ...completedEffects.network,
  ]);
  const changed = files.length > 0 || packages.length > 0;
  const findings = [
    ...packageFindings(installation),
    ...gitFindings(gitInitialized),
    ...eslintFindings(eslintPolicy),
    ...guidanceFindings,
    ...namespaceMigration.findings,
    ...(pythonSetup.tools.length === 0
      ? []
      : [
          {
            code: pythonSetup.installed ? 'PYTHON_TOOLS_INSTALLED' : 'PYTHON_TOOLS_REQUIRED',
            message: pythonSetup.installed
              ? `Python tools installed (${pythonSetup.tools.join(', ')}).`
              : `Install Python tools: ${pythonSetup.command ?? pythonSetup.tools.join(' ')}`,
            severity: 'info' as const,
          },
        ]),
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

function applyCompatibilityMigrations(
  cwd: string,
  completedEffects: CompletedSetupEffects,
): Effect[] {
  const missingPacks = getMissingPacks(cwd);
  const effects: Effect[] = [];
  for (const packId of missingPacks) {
    const installed = observeFileStage(cwd, ['.safeword'], completedEffects, () =>
      installPack(packId, cwd).files.map(target => ({ kind: 'create', target })),
    );
    effects.push(...installed);
  }
  if (missingPacks.length > 0) {
    const configEffect = { kind: 'update', target: '.safeword/config.json' };
    effects.push(configEffect);
  }
  if (
    observeFileStage(cwd, ['.safeword/config.json'], completedEffects, () =>
      stripDeadConfigVersion(nodePath.join(cwd, '.safeword')),
    )
  ) {
    const configEffect = { kind: 'update', target: '.safeword/config.json' };
    effects.push(configEffect);
  }
  return effects;
}

function recordInstalledPackages(
  packagesToInstall: readonly string[],
  installation: DependencyInstallResult,
  completedEffects: CompletedSetupEffects,
): void {
  if (!installation.attempted) return;
  for (const target of packagesToInstall) {
    if (installation.installed) completedEffects.packages.push({ kind: 'install', target });
    completedEffects.network.push({
      kind: 'package-registry',
      target,
      operation: 'install',
    });
  }
}

function applyPackageCompatibility(
  cwd: string,
  compatibilityEffects: Effect[],
  completedEffects: CompletedSetupEffects,
): string | undefined {
  if (!syncPackageJsonSafewordVersion(cwd, { report: false })) return undefined;
  const compatibilityPackage = `safeword@${VERSION}`;
  const fileEffect = { kind: 'update', target: 'package.json' };
  compatibilityEffects.push(fileEffect);
  completedEffects.packages.push({ kind: 'update', target: compatibilityPackage });
  completedEffects.network.push({
    kind: 'package-registry',
    target: compatibilityPackage,
    operation: 'update',
  });
  return compatibilityPackage;
}

interface ApplySetupInput {
  readonly configured: boolean;
  readonly packageJsonCreated: boolean;
  readonly noModify: boolean;
  readonly namespaceMigration: NamespaceConvergence;
  readonly adapters: SetupAdapters;
}

async function applySetup(cwd: string, input: ApplySetupInput): Promise<CliResult> {
  const { adapters, configured, namespaceMigration, noModify, packageJsonCreated } = input;
  const context = createProjectContext(cwd);
  const operation = configured ? 'upgrade' : 'install';
  const result = await reconcile(SAFEWORD_SCHEMA, operation, context);
  const completedEffects: CompletedSetupEffects = {
    files: [...effectsForReconciliation(result, 'upgrade').files],
    packages: [],
    network: [],
  };

  try {
    const compatibilityEffects = applyCompatibilityMigrations(cwd, completedEffects);
    const architectureEffects = observeFileStage(
      cwd,
      ['.safeword/depcruise-config.cjs', '.dependency-cruiser.cjs'],
      completedEffects,
      () => adapters.configureArchitecture(cwd),
    );
    const workspaceEffects = observeFileStage(
      cwd,
      workspacePackageJsonTargets(cwd, context),
      completedEffects,
      () => adapters.configureWorkspaces(cwd, context),
    ).map(target => ({ kind: 'update', target }));
    const eslintConfig = context.projectType.existingEslintConfig;
    const eslintPolicy = observeFileStage(
      cwd,
      eslintConfig === undefined ? [] : [eslintConfig, `${eslintConfig}.safeword-bak`],
      completedEffects,
      () =>
        applyVendoredIgnoresPolicy({
          cwd,
          existingEslintConfig: eslintConfig,
          hasJavaScript: context.languages?.javascript ?? false,
          noModify,
        }),
    );
    const packageFiles = [
      'package.json',
      'bun.lock',
      'bun.lockb',
      'package-lock.json',
      'pnpm-lock.yaml',
      'yarn.lock',
    ];
    const installation = observeFileStage(cwd, packageFiles, completedEffects, () =>
      installDependencies(cwd, result.packagesToInstall, 'missing packages', {
        report: false,
      }),
    );
    recordInstalledPackages(result.packagesToInstall, installation, completedEffects);
    const pythonSetup = observeFileStage(
      cwd,
      ['pyproject.toml', 'uv.lock', 'poetry.lock', 'Pipfile', 'Pipfile.lock'],
      completedEffects,
      () => adapters.configurePython(cwd, context),
    );
    if (pythonSetup.attempted) {
      for (const target of pythonSetup.tools) {
        if (pythonSetup.installed) completedEffects.packages.push({ kind: 'install', target });
        completedEffects.network.push({
          kind: 'package-registry',
          target,
          operation: 'install',
        });
      }
    }
    const compatibilityPackage = observeFileStage(cwd, ['package.json'], completedEffects, () =>
      applyPackageCompatibility(cwd, compatibilityEffects, completedEffects),
    );
    const applied = setupResult({
      cwd,
      reconciliation: result,
      packageJsonCreated,
      architectureEffects,
      workspaceEffects,
      installation,
      eslintPolicy,
      compatibilityEffects,
      compatibilityPackage,
      gitInitialized: context.isGitRepo,
      guidanceFindings: setupGuidanceFindings(context, result, architectureEffects),
      pythonSetup,
      namespaceMigration,
      completedEffects,
    });
    const health = await checkHealth(cwd, {
      skipPackageChecks: Boolean(process.env.SAFEWORD_SKIP_INSTALL),
    });
    return verifiedSetupResult(applied, health, configured);
  } catch (setupError) {
    throw new SetupApplyError(setupError, completedEffects);
  }
}

function verifiedSetupResult(
  applied: CliResult,
  health: HealthStatus,
  wasConfigured: boolean,
): CliResult {
  const healthProblems = [
    ...health.issues,
    ...health.missingPackages.map(packageName => `Missing package: ${packageName}`),
    ...health.missingPacks.map(pack => `Missing language pack: ${pack}`),
  ];
  if (!health.configured || healthProblems.length > 0) {
    if (wasConfigured && health.configured) {
      return {
        ...applied,
        findings: [
          ...applied.findings,
          ...healthProblems.map(message => ({
            code: 'SETUP_POSTCONDITION_ADVISORY',
            message,
            severity: 'warning' as const,
          })),
          ...health.advisories.map(message => ({
            code: 'SETUP_HEALTH_ADVISORY',
            message,
            severity: 'info' as const,
          })),
        ],
      };
    }
    return {
      ...applied,
      ok: false,
      state: 'failed',
      findings: [
        ...applied.findings,
        ...health.advisories.map(message => ({
          code: 'SETUP_HEALTH_ADVISORY',
          message,
          severity: 'info' as const,
        })),
      ],
      errors: [
        ...applied.errors,
        ...(health.configured ? healthProblems : ['Safeword is not configured after setup.']).map(
          message => ({
            code: 'SETUP_POSTCONDITION_FAILED',
            message,
            retryable: true,
          }),
        ),
      ],
      recovery: [
        ...applied.recovery,
        {
          command: 'safeword doctor --verbose',
          description: 'Inspect the failed setup postcondition before retrying.',
          requiresHuman: true,
        },
      ],
    };
  }
  return {
    ...applied,
    findings: [
      ...applied.findings,
      ...health.advisories.map(message => ({
        code: 'SETUP_HEALTH_ADVISORY',
        message,
        severity: 'info' as const,
      })),
      {
        code: 'SETUP_POSTCONDITION_VERIFIED',
        message: 'Configuration is healthy',
        severity: 'info',
      },
    ],
  };
}

function setupFailure(setupError: unknown, initialEffects: Partial<Effects>): CliResult {
  const reconciliationEffects =
    setupError instanceof ReconcileExecutionError
      ? {
          files: [
            ...setupError.partial.created.map(target => ({ kind: 'create', target })),
            ...setupError.partial.updated.map(target => ({ kind: 'update', target })),
          ],
        }
      : {};
  const applyEffects = setupError instanceof SetupApplyError ? setupError.completedEffects : {};
  const effects = mergeEffects(initialEffects, reconciliationEffects, applyEffects);
  const changed = Object.values(effects).some(category => category.length > 0);
  return createResult({
    state: 'failed',
    changed,
    effects,
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

function mergeEffects(...groups: readonly Partial<Effects>[]): Partial<Effects> {
  const categories = ['files', 'packages', 'configuration', 'network', 'destructive'] as const;
  return Object.fromEntries(
    categories.map(category => [
      category,
      uniqueEffects(groups.flatMap(group => group[category] ?? [])),
    ]),
  );
}
