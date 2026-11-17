// cucumber-js config — safeword's BDD acceptance lane, separate from your unit
// tests. `tsx/esm` transpiles the TypeScript step definitions on the fly;
// `paths` are the Gherkin `.feature` files. Run via `npm run test:bdd` (or
// `bun run test:bdd`). Safeword owns this file; step definitions and features
// are yours. Relocated lanes: set `paths.features` / `paths.steps` in
// .safeword/config.json — they AUGMENT the default globs below.
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

const projectRoot = import.meta.dirname;

/**
 * Keep a configured path only when it is a non-empty string.
 * @param {unknown} value - Raw value read from .safeword/config.json.
 * @returns {string | undefined} The value, or undefined when unusable.
 */
function nonEmptyString(value) {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Configured lane directories from .safeword/config.json (safe on missing or
 * unparseable config — defaults below always apply).
 * @returns {{ features: string | undefined, steps: string | undefined }} Relocated lane directories.
 */
function readConfiguredLaneDirectories() {
  try {
    const config = JSON.parse(
      readFileSync(nodePath.join(projectRoot, '.safeword', 'config.json'), 'utf8'),
    );
    const paths = config?.paths ?? {};
    return { features: nonEmptyString(paths.features), steps: nonEmptyString(paths.steps) };
  } catch {
    return { features: undefined, steps: undefined };
  }
}

const { features: configuredFeaturesDirectory, steps: configuredStepsDirectory } =
  readConfiguredLaneDirectories();

const workspaceFeaturePaths = [
  'features/**/*.feature',
  'packages/*/features/**/*.feature',
  'apps/*/features/**/*.feature',
  'libs/*/features/**/*.feature',
  'modules/*/features/**/*.feature',
  ...(configuredFeaturesDirectory ? [`${configuredFeaturesDirectory}/**/*.feature`] : []),
];

const workspaceStepImports = [
  'tsx/esm',
  'steps/**/*.ts',
  'packages/*/features/steps/**/*.ts',
  'apps/*/features/steps/**/*.ts',
  'libs/*/features/steps/**/*.ts',
  'modules/*/features/steps/**/*.ts',
  ...(configuredStepsDirectory ? [`${configuredStepsDirectory}/**/*.ts`] : []),
];

const defaultTags = 'not @wip and not @proof.vitest and not @manual and not @live';
const liveTags = '@live and not @manual';

const cliFeatureDirectories = new Set([
  'features',
  'packages',
  'apps',
  'libs',
  'modules',
  // A bare configured directory passed as a positional arg is a feature path
  // too — without this, `cucumber-js tests/behaviors` would still get the
  // config's default paths merged in.
  ...(configuredFeaturesDirectory
    ? [configuredFeaturesDirectory, configuredFeaturesDirectory.split('/', 1)[0]]
    : []),
]);

/**
 * Whether an argument is a `.feature` path, optionally with Cucumber line
 * selectors (`example.feature:12`, `example.feature:12:30`).
 * @param {string} argument - A positional argument passed to cucumber-js.
 * @returns {boolean} True for a feature file path with valid line selectors.
 */
function isFeatureFileArgument(argument) {
  const marker = '.feature';
  const markerIndex = argument.lastIndexOf(marker);
  if (markerIndex === -1) {
    return false;
  }
  const [leading, ...lines] = argument.slice(markerIndex + marker.length).split(':');
  return leading === '' && lines.every(line => /^\d+$/.test(line));
}

/**
 * Whether one CLI argument names a feature file or feature directory.
 * @param {string} argument - A positional or flag argument passed to cucumber-js.
 * @returns {boolean} True when the argument selects features.
 */
function isCliFeaturePathArgument(argument) {
  if (argument.startsWith('-')) {
    return false;
  }
  return (
    isFeatureFileArgument(argument) ||
    argument.includes('*.feature') ||
    cliFeatureDirectories.has(argument)
  );
}

/**
 * Whether the cucumber-js invocation already names the features to run.
 * @param {string[]} argv - CLI arguments after the executable.
 * @returns {boolean} True when any argument selects features.
 */
export function hasCliFeaturePath(argv = process.argv.slice(2)) {
  return argv.some(argument => isCliFeaturePathArgument(argument));
}

/**
 * Build the default lane config; CLI feature paths replace the default globs.
 * @param {string[]} argv - CLI arguments after the executable.
 * @returns {Record<string, unknown>} cucumber-js configuration.
 */
export function buildCucumberConfig(argv = process.argv.slice(2)) {
  const config = {
    import: workspaceStepImports,
    tags: defaultTags,
  };

  if (!hasCliFeaturePath(argv)) {
    config.paths = workspaceFeaturePaths;
  }

  return config;
}

/**
 * Build the `live` profile: the default lane config restricted to `@live` scenarios.
 * @param {string[]} argv - CLI arguments after the executable.
 * @returns {Record<string, unknown>} cucumber-js configuration.
 */
function buildLiveCucumberConfig(argv = process.argv.slice(2)) {
  return {
    ...buildCucumberConfig(argv),
    tags: liveTags,
  };
}

export const live = buildLiveCucumberConfig();

export default buildCucumberConfig();
