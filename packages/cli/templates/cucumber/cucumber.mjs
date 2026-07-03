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

function nonEmptyString(value) {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

// Configured lane directories from .safeword/config.json (safe on missing or
// unparseable config — defaults below always apply).
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

function isCliFeaturePathArgument(argument) {
  if (argument.startsWith('-')) return false;
  return (
    argument.endsWith('.feature') ||
    argument.includes('*.feature') ||
    cliFeatureDirectories.has(argument)
  );
}

export function hasCliFeaturePath(argv = process.argv.slice(2)) {
  return argv.some(argument => isCliFeaturePathArgument(argument));
}

export function buildCucumberConfig(argv = process.argv.slice(2)) {
  const config = {
    import: workspaceStepImports,
    tags: 'not @manual and not @live',
  };

  if (!hasCliFeaturePath(argv)) {
    config.paths = workspaceFeaturePaths;
  }

  return config;
}

export default buildCucumberConfig();
