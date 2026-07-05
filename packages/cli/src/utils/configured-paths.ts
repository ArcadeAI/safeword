/**
 * Resolves user-configurable read targets and documentation sources.
 *
 * Reads `.safeword/config.json` for an optional `paths` object — each key
 * maps to a file path the user wants safeword to read instead of the
 * default `<namespace-root>/<key>.md` location (see resolveNamespaceRoot).
 *
 * Path resolution:
 * - Relative paths resolve against project root (the directory containing
 *   `.safeword/config.json`, which equals `cwd` in current invocations).
 * - Absolute paths are used verbatim.
 * - Empty-string or non-string values are treated as unset (defensive).
 *
 * See ticket K7N2QM for the design rationale, including why this is not a
 * cosmiconfig-style discovery layer and why N=3 doesn't warrant a
 * logical-filesystem abstraction.
 */

import nodePath from 'node:path';

import { isDirectory, readFileSafe } from './fs.js';

/** Logical project-knowledge keys safeword knows how to override via `paths.*`. */
export type ConfiguredPathKey = 'personas' | 'glossary' | 'surfaces' | 'architecture';

/**
 * Directory keys under `paths.*` (unlike ConfiguredPathKey, these point at
 * directories, following the `projectRoot` pattern). `features`/`steps`
 * (ticket 56JCFZ) AUGMENT the default BDD-lane search set — defaults stay
 * searched — so relocated or host-owned lanes are readable without
 * abandoning root `features/`+`steps/`.
 */
export type ConfiguredDirectoryKey = 'projectRoot' | 'features' | 'steps';

export type ConfiguredDocumentationSource =
  | { type: 'local'; path: string; resolvedPath: string }
  | { type: 'url'; url: string }
  | { type: 'git'; repo: string; path?: string };

export type ConfiguredDocumentationSourceDecision =
  | { kind: 'unset' }
  | { kind: 'explicit-none' }
  | { kind: 'configured'; sources: ConfiguredDocumentationSource[] };

interface SafewordConfigShape {
  paths?: Partial<Record<ConfiguredPathKey | ConfiguredDirectoryKey, unknown>>;
  bdd?: {
    conventions?: unknown;
  };
  docs?: {
    sources?: unknown;
  };
  architectureDocEnforcement?: unknown;
}

const CONFIG_SUBPATH = ['.safeword', 'config.json'];

/** Default namespace root for fresh contexts (epic AQJ95G). */
const NAMESPACE_ROOT_DEFAULT = '.project';

/** Legacy namespace root, honored where it already exists (pre-AQJ95G installs). */
export const NAMESPACE_ROOT_LEGACY = '.safeword-project';

function readSafewordConfig(cwd: string): SafewordConfigShape | undefined {
  const configPath = nodePath.join(cwd, ...CONFIG_SUBPATH);
  const content = readFileSafe(configPath);
  if (content === undefined) return undefined;

  try {
    return JSON.parse(content) as SafewordConfigShape;
  } catch {
    return undefined;
  }
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function parseLocalDocumentationSource(
  cwd: string,
  entry: Record<string, unknown>,
): ConfiguredDocumentationSource | undefined {
  if (!nonEmptyString(entry.path)) return undefined;
  const rawPath = entry.path;
  return {
    type: 'local',
    path: rawPath,
    resolvedPath: nodePath.isAbsolute(rawPath) ? rawPath : nodePath.join(cwd, rawPath),
  };
}

function parseUrlDocumentationSource(
  entry: Record<string, unknown>,
): ConfiguredDocumentationSource | undefined {
  return nonEmptyString(entry.url) ? { type: 'url', url: entry.url } : undefined;
}

function parseGitDocumentationSource(
  entry: Record<string, unknown>,
): ConfiguredDocumentationSource | undefined {
  if (!nonEmptyString(entry.repo)) return undefined;
  return nonEmptyString(entry.path)
    ? { type: 'git', repo: entry.repo, path: entry.path }
    : { type: 'git', repo: entry.repo };
}

/**
 * Read the override path for `key` from `.safeword/config.json`, if any.
 * Returns the raw override string (unresolved) or `undefined` when unset,
 * empty, non-string, or the config file is missing/unparseable.
 *
 * Exported for callers that need to know "is this overridden?" without
 * resolving the path (e.g., reconcile's `configKey` gate, `safeword check`
 * advisory messaging).
 */
export function readConfiguredPath(
  cwd: string,
  key: ConfiguredPathKey | ConfiguredDirectoryKey,
): string | undefined {
  const parsed = readSafewordConfig(cwd);

  const raw = parsed?.paths?.[key];
  if (!nonEmptyString(raw)) return undefined;
  return raw;
}

/**
 * Absolute path of a configured lane directory (`paths.features` /
 * `paths.steps`, ticket 56JCFZ), or undefined when unset. Consumers add the
 * result to their default search set (augment, never replace).
 */
export function resolveConfiguredLaneDirectory(
  cwd: string,
  key: 'features' | 'steps',
): string | undefined {
  const configured = readConfiguredPath(cwd, key);
  if (configured === undefined) return undefined;
  return nodePath.isAbsolute(configured) ? configured : nodePath.join(cwd, configured);
}

/**
 * The host-owned BDD conventions doc (`bdd.conventions`, ticket 7CK2KP): a
 * path to a document describing the host harness's house style — stub shape,
 * spec-ahead verification lane, tag rules, step layout. Agents read and follow
 * it over safeword's defaults; safeword only surfaces the pointer (codify,
 * installed prose). Returned as configured (repo-relative or absolute) —
 * nothing here dereferences or validates the file, so a stale pointer is
 * visible rather than silently dropped.
 */
export function readBddConventionsPath(cwd: string): string | undefined {
  const raw = readSafewordConfig(cwd)?.bdd?.conventions;
  return nonEmptyString(raw) ? raw : undefined;
}

/**
 * Whether architecture-doc staleness enforcement is active (ticket FPV0E4,
 * Slice 2). Default-ON: a missing config file, a missing key, or any non-`false`
 * value all resolve to enabled — only a literal `false` opts out. Defensive by
 * design: an unparseable config never silently disables enforcement.
 *
 * Read by both enforcement surfaces — the commit-time stage hook and the CI
 * `safeword architecture --check` backstop.
 */
export function isArchitectureDocumentEnforcementEnabled(cwd: string): boolean {
  const parsed = readSafewordConfig(cwd);
  return parsed?.architectureDocEnforcement !== false;
}

function parseConfiguredDocumentationSource(
  cwd: string,
  source: unknown,
): ConfiguredDocumentationSource | undefined {
  if (source === null || typeof source !== 'object') return undefined;
  const entry = source as Record<string, unknown>;
  switch (entry.type) {
    case 'local': {
      return parseLocalDocumentationSource(cwd, entry);
    }
    case 'url': {
      return parseUrlDocumentationSource(entry);
    }
    case 'git': {
      return parseGitDocumentationSource(entry);
    }
    default: {
      return undefined;
    }
  }
}

export function readConfiguredDocumentationSources(cwd: string): ConfiguredDocumentationSource[] {
  const decision = readConfiguredDocumentationSourceDecision(cwd);
  return decision.kind === 'configured' ? decision.sources : [];
}

export function readConfiguredDocumentationSourceDecision(
  cwd: string,
): ConfiguredDocumentationSourceDecision {
  const parsed = readSafewordConfig(cwd);
  const sources = parsed?.docs?.sources;
  if (!Array.isArray(sources)) return { kind: 'unset' };
  if (sources.length === 0) return { kind: 'explicit-none' };

  const configuredSources = sources.flatMap(source => {
    const parsedSource = parseConfiguredDocumentationSource(cwd, source);
    return parsedSource === undefined ? [] : [parsedSource];
  });
  return { kind: 'configured', sources: configuredSources };
}

/**
 * Resolve the absolute namespace root — the directory holding safeword's
 * project knowledge (tickets, learnings, personas, glossary, surfaces,
 * architecture).
 *
 * Precedence (epic AQJ95G): explicit config `paths.projectRoot` →
 * `.project/` (the default, shared with arcade) → legacy `.safeword-project/`
 * where one already exists. A project with neither directory resolves to
 * `.project/` so fresh contexts land on the current convention.
 */
export function resolveNamespaceRoot(cwd: string): string {
  const configured = readConfiguredPath(cwd, 'projectRoot');
  if (configured !== undefined) {
    return nodePath.isAbsolute(configured) ? configured : nodePath.join(cwd, configured);
  }

  const defaultRoot = nodePath.join(cwd, NAMESPACE_ROOT_DEFAULT);
  if (isDirectory(defaultRoot)) return defaultRoot;

  const legacyRoot = nodePath.join(cwd, NAMESPACE_ROOT_LEGACY);
  if (isDirectory(legacyRoot)) return legacyRoot;

  return defaultRoot;
}

/** Absolute tickets directory under the resolved namespace root. */
export function resolveTicketsDirectory(cwd: string): string {
  return nodePath.join(resolveNamespaceRoot(cwd), 'tickets');
}

/** Absolute learnings directory under the resolved namespace root. */
export function resolveLearningsDirectory(cwd: string): string {
  return nodePath.join(resolveNamespaceRoot(cwd), 'learnings');
}

/**
 * Fixed filename of the auto-generated architecture state document — used both
 * for the namespace-root doc/root index and for colocated monorepo leaf docs
 * (`packages/<pkg>/architecture.generated.md`, ticket XG9SFP).
 */
export const GENERATED_ARCHITECTURE_FILENAME = 'architecture.generated.md';

/**
 * Absolute path of the auto-generated architecture state document, under the
 * resolved namespace root (e.g. `.project/architecture.generated.md`).
 *
 * Deliberately fixed, NOT overridable via `paths.architecture`: the generated
 * point-in-time state doc is a separate artifact from the hand-curated
 * decision/ADR record that `paths.architecture` points to. The `.generated.`
 * infix marks it as machine-owned (do not hand-edit).
 */
export function resolveGeneratedArchitecturePath(cwd: string): string {
  return nodePath.join(resolveNamespaceRoot(cwd), GENERATED_ARCHITECTURE_FILENAME);
}

/**
 * The resolved architecture narrative location (ticket BY7RNR, GitHub #848):
 * where the human-authored architecture document lives for nudges, prompts,
 * and the drift advisory.
 */
export interface ArchitectureNarrative {
  /** Absolute path of the narrative target. Existence is NOT guaranteed. */
  absolutePath: string;
  /** Human-facing name: the as-written config value, or `ARCHITECTURE.md`. */
  displayPath: string;
  /** True when `paths.architecture` supplied the location. */
  configured: boolean;
}

/**
 * Resolve the architecture narrative: a non-empty `paths.architecture` wins
 * outright — even when its target is missing on disk, safeword never hunts
 * back to a root file the host deliberately moved away from — else root
 * `ARCHITECTURE.md`. Distinct from {@link resolveConfiguredPath}'s
 * `<namespace>/architecture.md` default, which serves K4BWTQ record listing;
 * changing that default would silently disable the AXRC4D nudge for every
 * existing root-`ARCHITECTURE.md` host.
 *
 * Mirrored standalone in the hook lib (`templates/hooks/lib/`); a differential
 * parity test pins the two copies (P58R22 pattern).
 */
export function resolveArchitectureNarrative(cwd: string): ArchitectureNarrative {
  const configured = readConfiguredPath(cwd, 'architecture');
  if (configured !== undefined) {
    return {
      absolutePath: nodePath.isAbsolute(configured) ? configured : nodePath.join(cwd, configured),
      displayPath: configured,
      configured: true,
    };
  }
  return {
    absolutePath: nodePath.join(cwd, 'ARCHITECTURE.md'),
    displayPath: 'ARCHITECTURE.md',
    configured: false,
  };
}

/**
 * The default (non-overridden) absolute location of a configurable read
 * target: `<resolveNamespaceRoot(cwd)>/<key>.md`.
 */
export function defaultConfiguredPath(cwd: string, key: ConfiguredPathKey): string {
  return nodePath.join(resolveNamespaceRoot(cwd), `${key}.md`);
}

/**
 * Resolve the absolute filesystem path for a configurable read target.
 *
 * Without a per-file override, the default derives from the resolved
 * namespace root (see {@link defaultConfiguredPath}).
 *
 * @param cwd - Project root directory.
 * @param key - Logical project-knowledge key.
 */
export function resolveConfiguredPath(cwd: string, key: ConfiguredPathKey): string {
  const override = readConfiguredPath(cwd, key);
  if (override === undefined) {
    return defaultConfiguredPath(cwd, key);
  }
  if (nodePath.isAbsolute(override)) {
    return override;
  }
  return nodePath.join(cwd, override);
}
