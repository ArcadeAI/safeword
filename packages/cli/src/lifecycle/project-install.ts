import { createHash } from 'node:crypto';
import type { Stats } from 'node:fs';
import {
  closeSync,
  constants as fsConstants,
  existsSync,
  fstatSync,
  lstatSync,
  openSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  readSync,
} from 'node:fs';
import nodePath from 'node:path';

import { schemaForClaudeDelivery } from '../claude-plugin/delivery-schema.js';
import { CLAUDE_PLUGIN_ID } from '../claude-plugin/inventory.js';
import { diffFileSnapshots } from '../cli-protocol/file-effects.js';
import type { CliPlan } from '../cli-protocol/plan.js';
import { createPlan } from '../cli-protocol/plan.js';
import {
  createReconciliationPlan,
  effectsForReconciliation,
  preconditionDigestForPaths,
} from '../cli-protocol/reconciliation.js';
import { buildReplayCommand } from '../cli-protocol/replay-command.js';
import {
  type CliResult,
  combineEffects,
  createResult,
  type Effect,
  type Effects,
  type Finding,
} from '../cli-protocol/result.js';
import { writeDurableFile } from '../codex-plugin/durable-write.js';
import { codexFinalizationIsComplete } from '../codex-plugin/finalization.js';
import { CODEX_MIGRATION_SCHEMA } from '../codex-plugin/inventory.js';
import { automaticallyMigrateLegacyCodex } from '../codex-plugin/operations.js';
import {
  installCodexProjectBootstrap,
  preparedCodexProjectBootstrap,
} from '../codex-plugin/project-bootstrap.js';
import {
  buildArchitecture,
  hasArchitectureDetected,
  inspectConfig,
  syncConfigCore,
} from '../commands/sync-config.js';
import { checkHealth, type HealthStatus } from '../health.js';
import { installPack } from '../packs/install.js';
import { hasImportLinterScaffoldTarget } from '../packs/python/files.js';
import {
  detectPythonPackageManager,
  getPythonInstallCommand,
  getPythonToolDependencyGaps,
  installPythonDependencyBatch,
  type PythonTool,
} from '../packs/python/setup.js';
import { getMissingPacks } from '../packs/registry.js';
import { rustToolingTargets } from '../packs/rust/setup.js';
import { reconcile, ReconcileExecutionError, type ReconcileResult } from '../reconcile.js';
import {
  ensurePublicRetroProjectConfig,
  publicRetroConfigNeedsUpdate,
  validatePublicRetroProjectConfig,
} from '../retro/public-config.js';
import type { SafewordSchema } from '../schema.js';
import { createProjectContext } from '../utils/context.js';
import { exists, writeJson } from '../utils/fs.js';
import { hookIntegrationNudge } from '../utils/hook-nudge.js';
import {
  type DependencyInstallResult,
  detectPackageManager,
  installDependencies,
} from '../utils/install.js';
import {
  executeNamespaceMigration,
  NamespaceMergeIncompleteError,
  NamespaceStructuralCollisionError,
  planNamespaceMigration,
} from '../utils/namespace-migration.js';
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
  shouldEmitVendoredIgnoresNudge,
  type VendoredIgnoresPolicyResult,
} from '../utils/vendored-ignores-nudge.js';
import { compareVersions, isSafePackageVersion } from '../utils/version.js';
import { VERSION } from '../version.js';

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

const EMPTY_LANGUAGES = {
  javascript: false,
  python: false,
  golang: false,
  rust: false,
  sql: false,
} as const;

const DEFAULT_SETUP_ADAPTERS: SetupAdapters = {
  configureArchitecture,
  configureWorkspaces: setupWorkspaceFormatScripts,
  configurePython,
  executeNamespaceMigration,
};

const JAVASCRIPT_PACKAGE_FILES = [
  'package.json',
  'bun.lock',
  'bun.lockb',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
] as const;

const PYTHON_PACKAGE_FILES = [
  'pyproject.toml',
  'uv.lock',
  'poetry.lock',
  'Pipfile',
  'Pipfile.lock',
] as const;

function plannedFileEffect(cwd: string, target: string): Effect {
  return { kind: existsSync(nodePath.join(cwd, target)) ? 'update' : 'create', target };
}

function existingFileEffects(cwd: string, targets: readonly string[]): Effect[] {
  return targets.flatMap(target =>
    existsSync(nodePath.join(cwd, target)) ? [{ kind: 'update', target }] : [],
  );
}

function plannedJavaScriptPackageFiles(cwd: string): Effect[] {
  const lockfiles = {
    bun: 'bun.lock',
    npm: 'package-lock.json',
    pnpm: 'pnpm-lock.yaml',
    yarn: 'yarn.lock',
  } as const;
  const selectedLockfile = lockfiles[detectPackageManager(cwd)];
  return uniqueEffects([
    ...existingFileEffects(cwd, JAVASCRIPT_PACKAGE_FILES),
    plannedFileEffect(cwd, selectedLockfile),
  ]);
}

function configNeedsCompatibilityUpdate(cwd: string): boolean {
  if (publicRetroConfigNeedsUpdate(cwd)) return true;
  if (getMissingPacks(cwd).length > 0) return true;
  try {
    const config = JSON.parse(
      readFileSync(nodePath.join(cwd, '.safeword/config.json'), 'utf8'),
    ) as Record<string, unknown>;
    return 'version' in config;
  } catch {
    return false;
  }
}

function plannedCodexBootstrapEffect(cwd: string): Effect[] {
  const target = '.codex/config.toml';
  const path = nodePath.join(cwd, target);
  const original = existsSync(path) ? readFileSync(path, 'utf8') : '';
  try {
    return preparedCodexProjectBootstrap(cwd) === original ? [] : [plannedFileEffect(cwd, target)];
  } catch {
    // Apply will fail before mutating an unsafe or malformed config. There is
    // no file effect to promise in that state.
    return [];
  }
}

function plannedArchitectureEffects(cwd: string): Effect[] {
  const architecture = buildArchitecture(cwd);
  if (!hasArchitectureDetected(architecture)) return [];
  const generated = inspectConfig(cwd, architecture);
  return [
    ...(generated.matches ? [] : [plannedFileEffect(cwd, '.safeword/depcruise-config.cjs')]),
    ...(existsSync(nodePath.join(cwd, '.dependency-cruiser.cjs'))
      ? []
      : [{ kind: 'create', target: '.dependency-cruiser.cjs' }]),
  ];
}

function plannedWorkspaceEffects(
  cwd: string,
  context: ReturnType<typeof createProjectContext>,
): Effect[] {
  return workspacePackageJsonTargets(cwd, context).flatMap(target => {
    try {
      const manifest = JSON.parse(readFileSync(nodePath.join(cwd, target), 'utf8')) as {
        scripts?: Record<string, string>;
      };
      return manifest.scripts?.format === undefined ? [{ kind: 'update', target }] : [];
    } catch {
      return [];
    }
  });
}

function plannedEslintEffects(
  cwd: string,
  context: ReturnType<typeof createProjectContext>,
): Effect[] {
  const target = context.projectType.existingEslintConfig;
  if (
    target === undefined ||
    !shouldEmitVendoredIgnoresNudge({
      cwd,
      existingEslintConfig: target,
      hasJavaScript: context.languages?.javascript ?? false,
    })
  ) {
    return [];
  }
  // The textual patch can bail on an unfamiliar export shape. Listing both
  // possible writes is deliberately conservative: a plan may be a superset,
  // but apply must never expand beyond it.
  return [{ kind: 'update', target }, plannedFileEffect(cwd, `${target}.safeword-bak`)];
}

function plannedPackEffects(cwd: string): Effect[] {
  return getMissingPacks(cwd).includes('rust')
    ? rustToolingTargets(cwd).map(target => ({ kind: 'update', target }))
    : [];
}

function plannedPythonEffects(cwd: string): Effects {
  if (!createProjectContext(cwd).languages?.python) {
    return emptyEffects();
  }
  const gaps = getPythonToolDependencyGaps(cwd, hasImportLinterScaffoldTarget);
  const lockfiles = {
    uv: 'uv.lock',
    poetry: 'poetry.lock',
    pipenv: 'Pipfile.lock',
  } as const;
  const installable = gaps.flatMap(gap => {
    const packageManager = detectPythonPackageManager(gap.directory, cwd);
    if (packageManager === 'pip') return [];
    const prefix = nodePath.relative(cwd, gap.directory);
    const target = (file: string): string => (prefix === '' ? file : nodePath.join(prefix, file));
    return [
      {
        tools: gap.tools,
        files: uniqueEffects([
          ...existingFileEffects(gap.directory, PYTHON_PACKAGE_FILES).map(effect => ({
            ...effect,
            target: target(effect.target),
          })),
          plannedFileEffect(cwd, target(lockfiles[packageManager])),
        ]),
      },
    ];
  });
  const tools = [...new Set(installable.flatMap(item => item.tools))];
  return {
    files: uniqueEffects(installable.flatMap(item => item.files)),
    packages: tools.map(target => ({ kind: 'install', target })),
    configuration: [],
    network: tools.map(target => ({ kind: 'package-registry', target, operation: 'install' })),
    destructive: [],
  };
}

function staleSafewordRegistryDependency(cwd: string): boolean {
  try {
    const manifest = JSON.parse(readFileSync(nodePath.join(cwd, 'package.json'), 'utf8')) as Record<
      'dependencies' | 'devDependencies' | 'optionalDependencies',
      Record<string, string> | undefined
    >;
    const spec =
      manifest.devDependencies?.safeword ??
      manifest.dependencies?.safeword ??
      manifest.optionalDependencies?.safeword;
    if (spec === undefined) return false;
    if (
      /^(?:file:|link:|portal:|workspace:|git\+|github:|gitlab:|bitbucket:|https?:|\.{0,2}\/)/u.test(
        spec,
      )
    ) {
      return false;
    }
    return ![VERSION, `^${VERSION}`, `~${VERSION}`].includes(spec);
  } catch {
    return false;
  }
}

export interface SetupPlanOptions {
  readonly migrateNamespace?: boolean;
  readonly noModify?: boolean;
  readonly repairVersionMarker?: boolean;
}

function plannedNamespaceEffects(cwd: string, migrate: boolean | undefined): Effect[] {
  if (migrate !== true || planNamespaceMigration(cwd) !== 'offer') return [];
  const movedFiles = snapshotFiles(cwd, ['.safeword-project']).keys().toArray();
  return [
    { kind: 'move', target: '.safeword-project → .project' },
    ...movedFiles.flatMap(target => [
      { kind: 'delete', target },
      { kind: 'create', target: target.replace(/^\.safeword-project(?=\/|$)/u, '.project') },
    ]),
    ...(existsSync(nodePath.join(cwd, '.safeword/config.json'))
      ? [{ kind: 'update', target: '.safeword/config.json' }]
      : []),
  ];
}

function plannedPackageJsonEffects(cwd: string, configured: boolean): Effect[] {
  return !configured && !existsSync(nodePath.join(cwd, 'package.json'))
    ? [
        { kind: 'create', target: 'package.json' },
        { kind: 'update', target: 'package.json' },
      ]
    : [];
}

function retargetLegacyNamespace(effect: Effect): Effect {
  return {
    ...effect,
    target: effect.target.replace(/^\.safeword-project(?=\/|$)/u, '.project'),
  };
}

function plannedReconciliationEffects(effects: Effects, migrate: boolean | undefined): Effects {
  if (migrate !== true) return effects;
  return {
    files: effects.files.map(effect => retargetLegacyNamespace(effect)),
    packages: effects.packages.map(effect => retargetLegacyNamespace(effect)),
    configuration: effects.configuration.map(effect => retargetLegacyNamespace(effect)),
    network: effects.network.map(effect => retargetLegacyNamespace(effect)),
    destructive: effects.destructive.map(effect => retargetLegacyNamespace(effect)),
  };
}

function setupPlanningContext(
  cwd: string,
  configured: boolean,
): ReturnType<typeof createProjectContext> {
  const context = createProjectContext(cwd);
  if (configured || existsSync(nodePath.join(cwd, 'package.json'))) return context;
  return {
    ...context,
    languages: {
      ...EMPTY_LANGUAGES,
      ...context.languages,
      javascript: true,
    },
  };
}

function plannedOptionalEslintEffects(
  cwd: string,
  context: ReturnType<typeof createProjectContext>,
  noModify: boolean | undefined,
): Effect[] {
  return noModify === true ? [] : plannedEslintEffects(cwd, context);
}

function setupPreconditionDigest(
  cwd: string,
  reconciliationDigest: string,
  effects: Effects,
  context: ReturnType<typeof createProjectContext>,
  options: SetupPlanOptions,
): string {
  const observationTargets = [
    '.safeword',
    '.safeword-project',
    '.project',
    '.codex/config.toml',
    '.dependency-cruiser.cjs',
    'Cargo.toml',
    ...JAVASCRIPT_PACKAGE_FILES,
    ...PYTHON_PACKAGE_FILES,
    ...effects.files.map(effect => effect.target),
    ...effects.destructive.map(effect => effect.target),
  ].filter(target => !target.includes(' → '));
  return createHash('sha256')
    .update(
      JSON.stringify([
        reconciliationDigest,
        effects,
        JSON.stringify(context, (_key, value: unknown) =>
          typeof value === 'string' ? value.replaceAll(cwd, '<project>') : value,
        ),
        options,
        preconditionDigestForPaths(cwd, observationTargets),
      ]),
    )
    .digest('hex');
}

function plannedVersionMarkerEffects(cwd: string, repair: boolean | undefined): Effect[] {
  if (repair !== true) return [];
  const target = '.safeword/version';
  const path = nodePath.join(cwd, target);
  const metadata = lstatSync(path, { throwIfNoEntry: false });
  if (metadata?.isFile() !== true || metadata.isSymbolicLink()) return [];
  const version = readFileSync(path, 'utf8').trim();
  return metadata.nlink > 1 || !isSafePackageVersion(version) ? [{ kind: 'update', target }] : [];
}

/** Read-only counterpart of convergeSetup's complete project mutation pipeline. */
export async function createSetupPlan(
  cwd: string,
  schema: SafewordSchema,
  options: SetupPlanOptions = {},
): Promise<CliPlan> {
  const configured = existsSync(nodePath.join(cwd, '.safeword'));
  const context = setupPlanningContext(cwd, configured);
  const reconciliation = await createReconciliationPlan(
    cwd,
    configured ? 'upgrade' : 'install',
    schema,
    context,
  );
  const reconciliationEffects = plannedReconciliationEffects(
    reconciliation.plan.effects,
    options.migrateNamespace,
  );
  const reconciliationPackages = reconciliationEffects.packages.length > 0;
  const compatibilityFiles = [
    ...(!configured || configNeedsCompatibilityUpdate(cwd)
      ? [plannedFileEffect(cwd, '.safeword/config.json')]
      : []),
    ...(publicRetroConfigNeedsUpdate(cwd)
      ? [{ kind: 'update' as const, target: '.safeword/config.json' }]
      : []),
  ];
  const packageFiles = reconciliationPackages ? plannedJavaScriptPackageFiles(cwd) : [];
  const python = plannedPythonEffects(cwd);
  const staleSafeword = staleSafewordRegistryDependency(cwd);
  const compatibilityPackage = `safeword@${VERSION}`;
  const combined = combineEffects([
    reconciliationEffects,
    {
      files: uniqueEffects([
        ...plannedPackageJsonEffects(cwd, configured),
        ...plannedVersionMarkerEffects(cwd, options.repairVersionMarker),
        ...plannedNamespaceEffects(cwd, options.migrateNamespace),
        ...compatibilityFiles,
        ...plannedPackEffects(cwd),
        ...plannedCodexBootstrapEffect(cwd),
        ...plannedArchitectureEffects(cwd),
        ...plannedWorkspaceEffects(cwd, context),
        ...plannedOptionalEslintEffects(cwd, context, options.noModify),
        ...packageFiles,
        ...(staleSafeword ? plannedJavaScriptPackageFiles(cwd) : []),
      ]),
      packages: staleSafeword ? [{ kind: 'update', target: compatibilityPackage }] : [],
      network: staleSafeword
        ? [{ kind: 'package-registry', target: compatibilityPackage, operation: 'update' }]
        : [],
    },
    python,
  ]);
  const effects = mergeEffects(combined);
  return createPlan({
    command: 'setup',
    preconditionDigest: setupPreconditionDigest(
      cwd,
      reconciliation.plan.preconditionDigest,
      effects,
      context,
      options,
    ),
    effects,
    verification: [{ description: 'Re-run safeword status' }],
  });
}

interface PythonSetupResult {
  readonly tools: readonly PythonTool[];
  readonly attemptedTools: readonly PythonTool[];
  readonly installedTools: readonly PythonTool[];
  readonly command?: string;
  readonly attempted: boolean;
  readonly installed: boolean;
}

function configurePython(
  cwd: string,
  context: ReturnType<typeof createProjectContext>,
): PythonSetupResult {
  if (!context.languages?.python) {
    return {
      tools: [],
      attemptedTools: [],
      installedTools: [],
      attempted: false,
      installed: false,
    };
  }
  const gaps = getPythonToolDependencyGaps(cwd, hasImportLinterScaffoldTarget);
  const tools = [...new Set(gaps.flatMap(gap => gap.tools))];
  if (tools.length === 0) {
    return { tools, attemptedTools: [], installedTools: [], attempted: false, installed: false };
  }

  const commands = gaps.map(gap => ({
    ...gap,
    packageManager: detectPythonPackageManager(gap.directory, cwd),
    command: getPythonInstallCommand(gap.directory, gap.tools, cwd),
  }));
  const command = commands
    .map(item => {
      const relative = nodePath.relative(cwd, item.directory);
      return relative === '' ? item.command : `(cd ${JSON.stringify(relative)} && ${item.command})`;
    })
    .join(' && ');
  const installable = commands.filter(item => item.packageManager !== 'pip');
  const shouldInstall = !process.env.SAFEWORD_SKIP_INSTALL && installable.length > 0;
  if (!shouldInstall) {
    return {
      tools,
      attemptedTools: [],
      installedTools: [],
      command,
      attempted: false,
      installed: false,
    };
  }
  const installationResults = installPythonDependencyBatch(installable, cwd);
  const results = installable.map((item, index) => ({
    ...item,
    succeeded: installationResults[index],
  }));
  const attemptedTools = [...new Set(installable.flatMap(item => item.tools))];
  const installedTools = [...new Set(results.flatMap(item => (item.succeeded ? item.tools : [])))];
  return {
    tools,
    attemptedTools,
    installedTools,
    command,
    attempted: true,
    installed: installable.length === commands.length && results.every(result => result.succeeded),
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

function publicRetroConfigRefusal(cwd: string): CliResult | undefined {
  try {
    validatePublicRetroProjectConfig(cwd);
  } catch (error) {
    return setupFailure(error, {});
  }
  return undefined;
}

interface ConvergeSetupOptions {
  noModify?: boolean;
  migrateNamespace?: boolean;
  repairVersionMarker?: boolean;
  progress?: {
    readonly start: (message: string) => void;
    readonly stop: () => void;
  };
  adapters?: Partial<SetupAdapters>;
  schema?: SafewordSchema;
}

export async function convergeSetup(
  cwd: string,
  options: ConvergeSetupOptions,
): Promise<CliResult> {
  return publicRetroConfigRefusal(cwd) ?? convergeSetupValidated(cwd, options);
}

async function convergeSetupValidated(
  cwd: string,
  options: ConvergeSetupOptions,
): Promise<CliResult> {
  const configured = existsSync(nodePath.join(cwd, '.safeword'));
  const versionGate: ProjectVersionGate = configured
    ? checkProjectVersion(cwd, options.repairVersionMarker === true)
    : { repaired: false };
  if (versionGate.refusal !== undefined) return versionGate.refusal;
  const versionMarkerEffects: Effect[] = versionGate.repaired
    ? [{ kind: 'update', target: '.safeword/version' }]
    : [];
  let namespaceMigration: NamespaceConvergence = { effects: [], findings: [] };
  let packageJsonCreated = false;

  try {
    const adapters = {
      ...DEFAULT_SETUP_ADAPTERS,
      ...options.adapters,
    };
    const namespaceTargets = ['.safeword-project', '.project', '.safeword/config.json'];
    const namespaceBefore = snapshotFiles(cwd, namespaceTargets);
    try {
      namespaceMigration = convergeNamespace(
        cwd,
        options.migrateNamespace,
        adapters.executeNamespaceMigration,
      );
    } catch (error) {
      namespaceMigration = {
        effects: diffFileSnapshots(namespaceBefore, snapshotFiles(cwd, namespaceTargets)),
        findings: [],
      };
      throw error;
    }
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
      preliminaryFileEffects: versionMarkerEffects,
      adapters,
      schema: options.schema,
    });
  } catch (setupError) {
    return setupFailure(setupError, {
      files: [
        ...versionMarkerEffects,
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
  if (plan !== 'offer' && plan !== 'both-dirs') {
    const messages: Partial<Record<typeof plan, string>> = {
      blocked: 'Namespace migration skipped: .project exists but is not a directory.',
    };
    const message = messages[plan];
    return {
      effects: [],
      findings:
        message === undefined
          ? []
          : [{ code: 'NAMESPACE_MIGRATION_BLOCKED', message, severity: 'warning' }],
    };
  }
  if (migrate === false) {
    return {
      effects: [],
      findings: [
        {
          code: 'NAMESPACE_MIGRATION_AVAILABLE',
          message:
            'This project still uses .safeword-project because automatic namespace migration was explicitly disabled.',
          severity: 'info',
        },
      ],
    };
  }
  try {
    const migration = migrateNamespace(cwd);
    const staleConfigs = scanStaleNamespaceConfigs(cwd);
    return {
      effects: [{ kind: 'move', target: '.safeword-project → .project' }],
      findings: [
        {
          code: 'NAMESPACE_MIGRATED',
          message:
            migration.method === 'merge'
              ? `Project namespace merged into .project; ${migration.conflicts.length} conflicting file(s) were retained under .safeword/namespace-migration-conflicts-v1/.`
              : 'Project namespace moved to .project.',
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
    if (
      migrationError instanceof NamespaceStructuralCollisionError ||
      migrationError instanceof NamespaceMergeIncompleteError
    ) {
      throw migrationError;
    }
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

interface ProjectVersionGate {
  readonly repaired: boolean;
  readonly refusal?: CliResult;
}

type ProjectVersionMarker =
  | { readonly kind: 'version'; readonly value: string; readonly replaceEntry: boolean }
  | { readonly kind: 'gate'; readonly value: ProjectVersionGate };

function versionRefusal(
  code: string,
  message: string,
  recovery: CliResult['recovery'] = [],
): ProjectVersionGate {
  return {
    repaired: false,
    refusal: createResult({
      state: 'failed',
      errors: [{ code, message, retryable: false }],
      recovery,
    }),
  };
}

const MAX_PROJECT_VERSION_BYTES = 256;

function isSafeProjectVersionMetadata(metadata: Stats, allowMultipleLinks: boolean): boolean {
  return (
    metadata.isFile() &&
    !metadata.isSymbolicLink() &&
    metadata.size <= MAX_PROJECT_VERSION_BYTES &&
    (allowMultipleLinks || metadata.nlink === 1)
  );
}

function isSameProjectVersionFile(before: Stats, opened: Stats, after: Stats): boolean {
  return (
    opened.isFile() &&
    after.isFile() &&
    !after.isSymbolicLink() &&
    opened.dev === before.dev &&
    opened.ino === before.ino &&
    opened.dev === after.dev &&
    opened.ino === after.ino
  );
}

function readProjectVersionDescriptor(descriptor: number): string | undefined {
  const buffer = Buffer.alloc(MAX_PROJECT_VERSION_BYTES + 1);
  const count = readSync(descriptor, buffer, 0, buffer.length, 0);
  const final = fstatSync(descriptor);
  if (count > MAX_PROJECT_VERSION_BYTES || final.size > MAX_PROJECT_VERSION_BYTES) {
    return undefined;
  }
  return buffer.subarray(0, count).toString('utf8').trim();
}

function readProjectVersionFile(path: string, allowMultipleLinks: boolean): string | undefined {
  let descriptor: number | undefined;
  try {
    const before = lstatSync(path);
    if (!isSafeProjectVersionMetadata(before, allowMultipleLinks)) return undefined;
    descriptor = openSync(
      path,
      fsConstants.O_RDONLY | fsConstants.O_NONBLOCK | (fsConstants.O_NOFOLLOW ?? 0),
    );
    const opened = fstatSync(descriptor);
    const after = lstatSync(path);
    if (
      !isSameProjectVersionFile(before, opened, after) ||
      !isSafeProjectVersionMetadata(opened, allowMultipleLinks)
    ) {
      return undefined;
    }
    return readProjectVersionDescriptor(descriptor);
  } catch {
    return undefined;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function readProjectVersionMarker(
  cwd: string,
  projectVersionPath: string,
  repairVersionMarker: boolean,
): ProjectVersionMarker {
  const metadata = lstatSync(projectVersionPath, { throwIfNoEntry: false });
  if (metadata === undefined) {
    return { kind: 'version', value: '0.0.0', replaceEntry: false };
  }
  if (metadata.isFile() && metadata.nlink === 1) {
    const version = readProjectVersionFile(projectVersionPath, false);
    if (version === undefined) {
      return {
        kind: 'gate',
        value: versionRefusal(
          'PROJECT_VERSION_MARKER_UNSAFE',
          'Project version marker changed while it was being validated. Inspect .safeword/version and retry setup.',
        ),
      };
    }
    return {
      kind: 'version',
      value: version,
      replaceEntry: false,
    };
  }
  if (!metadata.isFile() || metadata.nlink <= 1) {
    return {
      kind: 'gate',
      value: versionRefusal(
        'PROJECT_VERSION_MARKER_UNSAFE',
        'Project version marker is not an ordinary regular file. Inspect .safeword/version and replace it manually before running install; symbolic links are never followed or repaired.',
      ),
    };
  }
  if (repairVersionMarker) {
    const version = readProjectVersionFile(projectVersionPath, true);
    if (version === undefined) {
      return {
        kind: 'gate',
        value: versionRefusal(
          'PROJECT_VERSION_MARKER_UNSAFE',
          'Project version marker changed while it was being validated. Inspect .safeword/version and retry setup.',
        ),
      };
    }
    return {
      kind: 'version',
      value: version,
      replaceEntry: true,
    };
  }
  const recoveryCommand = buildReplayCommand({
    command: 'safeword install --repair-version-marker',
    cwd,
  });
  return {
    kind: 'gate',
    value: versionRefusal(
      'PROJECT_VERSION_MARKER_UNSAFE',
      `Project version marker has multiple directory entries. Inspect .safeword/version, then run \`${recoveryCommand}\` to replace only the project entry.`,
      [
        {
          command: recoveryCommand,
          description:
            'Replace the linked project version marker without changing its other hardlink peers, then complete installation.',
          requiresHuman: true,
        },
      ],
    ),
  };
}

function checkProjectVersion(cwd: string, repairVersionMarker: boolean): ProjectVersionGate {
  const safewordDirectoryPath = nodePath.join(cwd, '.safeword');
  const safewordDirectoryMetadata = lstatSync(safewordDirectoryPath, {
    throwIfNoEntry: false,
  });
  if (safewordDirectoryMetadata?.isDirectory() !== true) {
    return versionRefusal(
      'PROJECT_VERSION_UNSAFE',
      '.safeword must be an ordinary directory inside the project. Inspect and replace it manually before running install.',
    );
  }
  const projectVersionPath = nodePath.join(safewordDirectoryPath, 'version');
  const marker = readProjectVersionMarker(cwd, projectVersionPath, repairVersionMarker);
  if (marker.kind === 'gate') return marker.value;
  const projectVersion = marker.value;
  if (!isSafePackageVersion(projectVersion)) {
    if (repairVersionMarker) {
      writeDurableFile(projectVersionPath, `${VERSION}\n`, { mode: 0o644 });
      return { repaired: true };
    }
    const recoveryCommand = buildReplayCommand({
      command: 'safeword install --repair-version-marker',
      cwd,
    });
    return versionRefusal(
      'PROJECT_VERSION_UNSAFE',
      `Project version is not valid SemVer. Inspect .safeword/version, then run \`${recoveryCommand}\` to replace it.`,
      [
        {
          command: recoveryCommand,
          description:
            'Replace the unreadable version marker with the current CLI version, then complete installation.',
          requiresHuman: true,
        },
      ],
    );
  }
  if (compareVersions(VERSION, projectVersion) < 0) {
    return versionRefusal(
      'CLI_DOWNGRADE_REFUSED',
      `CLI v${VERSION} is older than project v${projectVersion}. Update the CLI first.`,
    );
  }
  if (marker.replaceEntry) {
    // Validate before mutation, then publish a fresh inode over only this
    // directory entry so a failed downgrade gate never changes the project.
    writeDurableFile(projectVersionPath, `${projectVersion}\n`, { mode: 0o644 });
    return { repaired: true };
  }
  return { repaired: false };
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

function pythonFindings(pythonSetup: PythonSetupResult): Finding[] {
  if (pythonSetup.tools.length === 0) return [];
  return [
    {
      code: pythonSetup.installed ? 'PYTHON_TOOLS_INSTALLED' : 'PYTHON_TOOLS_REQUIRED',
      message: pythonSetup.installed
        ? `Python tools installed (${pythonSetup.tools.join(', ')}).`
        : `Install Python tools: ${pythonSetup.command ?? pythonSetup.tools.join(' ')}`,
      severity: pythonSetup.installed ? 'info' : 'warning',
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
  readonly packageJsonCreated: boolean;
  readonly installation: DependencyInstallResult;
  readonly eslintPolicy: VendoredIgnoresPolicyResult;
  readonly gitInitialized: boolean;
  readonly guidanceFindings: ReturnType<typeof setupGuidanceFindings>;
  readonly pythonSetup: PythonSetupResult;
  readonly namespaceMigration: NamespaceConvergence;
  readonly completedEffects: CompletedSetupEffects;
  readonly claudeProjectPluginEnrolled: boolean;
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

function emptyEffects(): Effects {
  return { files: [], packages: [], configuration: [], network: [], destructive: [] };
}

function setupResult(input: SetupResultInput): CliResult {
  const {
    packageJsonCreated,
    installation,
    eslintPolicy,
    gitInitialized,
    guidanceFindings,
    pythonSetup,
    namespaceMigration,
    completedEffects,
    claudeProjectPluginEnrolled,
  } = input;
  const files = uniqueEffects([
    ...(packageJsonCreated ? [{ kind: 'create', target: 'package.json' }] : []),
    ...namespaceMigration.effects,
    ...completedEffects.files,
  ]);
  const packages = uniqueEffects(completedEffects.packages);
  const network = uniqueEffects(completedEffects.network);
  const changed = files.length > 0 || packages.length > 0;
  const findings = [
    ...packageFindings(installation),
    ...gitFindings(gitInitialized),
    ...eslintFindings(eslintPolicy),
    ...guidanceFindings,
    ...namespaceMigration.findings,
    ...pythonFindings(pythonSetup),
  ];
  // A failed automatic Codex handoff is intentionally advisory: the legacy
  // project integration remains active and the SessionStart bootstrap retries
  // enrollment for the next SessionStart/developer. Keep the warning loud without
  // turning an otherwise successful setup into a blocking exit status.
  const actionRequired = findings.some(
    finding => finding.severity !== 'info' && finding.code !== 'CODEX_PLUGIN_HANDOFF_DEFERRED',
  );
  const handoffDeferred = findings.some(
    finding => finding.code === 'CODEX_PLUGIN_HANDOFF_DEFERRED',
  );
  // `.claude/settings.json` records enrollment but not the enrolled version, so
  // it can only prove "already converged" when this run changed nothing. A run
  // that rewrote delivered files may have moved the templates past the version
  // Claude installed, and `/reload-plugins` re-reads the old build — the
  // install command is what actually converges that case.
  const claudePluginReloadEligible = claudeProjectPluginEnrolled && !changed;
  const resultFindings = [
    ...findings,
    // Suppressed while a handoff is deferred: claiming enrollment succeeded
    // would contradict the warning this run just emitted.
    ...(actionRequired || handoffDeferred
      ? []
      : [
          {
            code: 'SETUP_CODEX_PLUGIN_HANDOFF',
            message:
              'Codex bootstrap is enrolled for this project; each developer profile is checked automatically at task start.',
            severity: 'info' as const,
          },
        ]),
    ...(claudePluginReloadEligible
      ? [
          {
            code: 'SETUP_CLAUDE_PLUGIN_PRESERVED',
            message:
              'The project-scoped Claude plugin remains enabled; reload plugins to activate any refreshed configuration.',
            severity: 'info' as const,
          },
        ]
      : []),
  ];
  let state: CliResult['state'] = changed ? 'changed' : 'healthy';
  if (actionRequired) state = 'action_required';
  const nextAction = setupNextAction({
    actionRequired,
    claudePluginReloadEligible,
    installCommand: installation.command,
    pythonInstallCommand: pythonSetup.installed ? undefined : pythonSetup.command,
  });
  return createResult({
    state,
    changed,
    effects: { files, packages, network },
    findings: resultFindings,
    nextActions: [nextAction],
    data: { configured: true, dependency_install: installation },
  });
}

function setupNextAction(input: {
  readonly actionRequired: boolean;
  readonly claudePluginReloadEligible: boolean;
  readonly installCommand?: string;
  readonly pythonInstallCommand?: string;
}): { command: string; mutates: boolean; requiresHuman: boolean } {
  if (input.actionRequired) {
    return {
      command: input.pythonInstallCommand ?? input.installCommand ?? 'safeword install',
      mutates: true,
      requiresHuman: true,
    };
  }
  if (input.claudePluginReloadEligible) {
    return { command: '/reload-plugins', mutates: false, requiresHuman: true };
  }
  return { command: 'safeword install --agents=claude', mutates: true, requiresHuman: true };
}

function projectClaudePluginEnrolled(cwd: string): boolean {
  try {
    const settings = JSON.parse(
      readFileSync(nodePath.join(cwd, '.claude/settings.json'), 'utf8'),
    ) as { enabledPlugins?: Record<string, unknown> };
    return settings.enabledPlugins?.[CLAUDE_PLUGIN_ID] === true;
  } catch {
    return false;
  }
}

function applyCompatibilityMigrations(cwd: string, completedEffects: CompletedSetupEffects): void {
  const missingPacks = getMissingPacks(cwd);
  for (const packId of missingPacks) {
    const targets = [
      '.safeword/config.json',
      ...(packId === 'rust' ? rustToolingTargets(cwd) : []),
    ];
    observeFileStage(cwd, targets, completedEffects, () => installPack(packId, cwd));
  }
  observeFileStage(cwd, ['.safeword/config.json'], completedEffects, () =>
    stripDeadConfigVersion(nodePath.join(cwd, '.safeword')),
  );
  observeFileStage(cwd, ['.safeword/config.json'], completedEffects, () =>
    ensurePublicRetroProjectConfig(cwd),
  );
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

function applyPackageCompatibility(cwd: string, completedEffects: CompletedSetupEffects): void {
  if (!syncPackageJsonSafewordVersion(cwd, { report: false })) return;
  const compatibilityPackage = `safeword@${VERSION}`;
  completedEffects.packages.push({ kind: 'update', target: compatibilityPackage });
  completedEffects.network.push({
    kind: 'package-registry',
    target: compatibilityPackage,
    operation: 'update',
  });
}

interface ApplySetupInput {
  readonly configured: boolean;
  readonly packageJsonCreated: boolean;
  readonly noModify: boolean;
  readonly namespaceMigration: NamespaceConvergence;
  readonly preliminaryFileEffects: readonly Effect[];
  readonly adapters: SetupAdapters;
  readonly schema?: SafewordSchema;
}

/**
 * Hand a legacy project-hook installation over to the native Codex plugin.
 * A failure here is reported, never fatal: the legacy protection stays in
 * place rather than leaving the project unguarded mid-setup.
 */
function migrateLegacyCodexDuringSetup(
  cwd: string,
  completedEffects: CompletedSetupEffects,
): Finding[] {
  const codexMigrationTargets = [
    CODEX_MIGRATION_SCHEMA.paths.config,
    CODEX_MIGRATION_SCHEMA.paths.backupRoot,
    CODEX_MIGRATION_SCHEMA.paths.pluginMarker,
    CODEX_MIGRATION_SCHEMA.paths.handoffReceipt,
    CODEX_MIGRATION_SCHEMA.paths.bootstrapSkill,
    ...CODEX_MIGRATION_SCHEMA.cleanupFiles,
  ];
  try {
    const migrated = observeFileStage(cwd, codexMigrationTargets, completedEffects, () =>
      automaticallyMigrateLegacyCodex(cwd),
    );
    if (!migrated) return [];
    const finalized = codexFinalizationIsComplete(cwd);
    return [
      {
        code: finalized ? 'CODEX_PLUGIN_HANDOFF_COMPLETE' : 'CODEX_PLUGIN_HANDOFF_PENDING_PROOF',
        message: finalized
          ? 'Codex verified the native profile plugin, backed up the legacy state, and retired the legacy project assets automatically.'
          : 'Codex enabled the native profile plugin and retained legacy project protection. After a restarted task records current hook proof, the next setup will finish the recoverable cleanup automatically.',
        severity: 'info',
      },
    ];
  } catch (error) {
    return [
      {
        code: 'CODEX_PLUGIN_HANDOFF_DEFERRED',
        message: `Codex native plugin handoff could not complete, so legacy project protection was retained: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'warning',
      },
    ];
  }
}

async function applySetup(cwd: string, input: ApplySetupInput): Promise<CliResult> {
  const {
    adapters,
    configured,
    namespaceMigration,
    noModify,
    packageJsonCreated,
    preliminaryFileEffects,
  } = input;
  const context = createProjectContext(cwd);
  const operation = configured ? 'upgrade' : 'install';
  const setupSchema = input.schema ?? schemaForClaudeDelivery(cwd);
  const result = await reconcile(setupSchema, operation, context);
  const completedEffects: CompletedSetupEffects = {
    files: [...preliminaryFileEffects, ...effectsForReconciliation(result, 'upgrade').files],
    packages: [],
    network: [],
  };

  try {
    applyCompatibilityMigrations(cwd, completedEffects);
    observeFileStage(cwd, ['.codex/config.toml'], completedEffects, () =>
      installCodexProjectBootstrap(cwd),
    );
    const codexHandoffFindings = migrateLegacyCodexDuringSetup(cwd, completedEffects);
    const architectureEffects = observeFileStage(
      cwd,
      ['.safeword/depcruise-config.cjs', '.dependency-cruiser.cjs'],
      completedEffects,
      () => adapters.configureArchitecture(cwd),
    );
    observeFileStage(cwd, workspacePackageJsonTargets(cwd, context), completedEffects, () =>
      adapters.configureWorkspaces(cwd, context),
    );
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
      for (const target of pythonSetup.attemptedTools) {
        if (pythonSetup.installedTools.includes(target)) {
          completedEffects.packages.push({ kind: 'install', target });
        }
        completedEffects.network.push({
          kind: 'package-registry',
          target,
          operation: 'install',
        });
      }
    }
    observeFileStage(cwd, ['package.json'], completedEffects, () => {
      applyPackageCompatibility(cwd, completedEffects);
    });
    const applied = setupResult({
      packageJsonCreated,
      installation,
      eslintPolicy,
      gitInitialized: context.isGitRepo,
      guidanceFindings: [
        ...setupGuidanceFindings(context, result, architectureEffects),
        ...codexHandoffFindings,
      ],
      pythonSetup,
      namespaceMigration,
      completedEffects,
      claudeProjectPluginEnrolled: projectClaudePluginEnrolled(cwd),
    });
    const health = await checkHealth(cwd, {
      skipPackageChecks: Boolean(process.env.SAFEWORD_SKIP_INSTALL),
      skipPythonToolChecks: !configured && pythonSetup.tools.length > 0 && !pythonSetup.installed,
      schema: setupSchema,
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
    ...health.missingPythonTools.map(tool => `Missing Python tool: ${tool}`),
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
        ...(health.configured ? healthProblems : ['Safeword is not configured after install.']).map(
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
          description: 'Inspect the failed install postcondition before retrying.',
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
        description: 'Inspect the partial project state before retrying install.',
        requiresHuman: true,
      },
    ],
  });
}

function mergeEffects(...groups: readonly Partial<Effects>[]): Effects {
  const combined = combineEffects(groups);
  return {
    files: uniqueEffects(combined.files),
    packages: uniqueEffects(combined.packages),
    configuration: uniqueEffects(combined.configuration),
    network: uniqueEffects(combined.network),
    destructive: uniqueEffects(combined.destructive),
  };
}
