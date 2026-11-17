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

// A `.feature` path, optionally with Cucumber line selectors
// (`example.feature:12`, `example.feature:12:30`).
function isFeatureFileArgument(argument) {
  const marker = '.feature';
  const markerIndex = argument.lastIndexOf(marker);
  if (markerIndex === -1) return false;
  const [leading, ...lines] = argument.slice(markerIndex + marker.length).split(':');
  return leading === '' && lines.every(line => /^\d+$/.test(line));
}

function isCliFeaturePathArgument(argument) {
  return (
    isFeatureFileArgument(argument) ||
    argument.includes('*.feature') ||
    cliFeatureDirectories.has(argument)
  );
}

// Cucumber options that take a value as the next argument (`--name <REGEXP>`).
// That value is never a feature path, even when it ends in `.feature`; the
// `--option=value` form is a single argument and needs no special case.
const valueTakingOptions = new Set([
  '-c',
  '--config',
  '-f',
  '--format',
  '--format-options',
  '--i18n-keywords',
  '-i',
  '--import',
  '-l',
  '--loader',
  '--language',
  '--name',
  '--order',
  '-p',
  '--profile',
  '--parallel',
  '--plugin',
  '--plugin-options',
  '-r',
  '--require',
  '--require-module',
  '--retry',
  '--retry-tag-filter',
  '--shard',
  '-t',
  '--tags',
  '--world-parameters',
]);

// Positional (feature path) arguments: everything except options and their
// values, plus every argument after a bare `--`.
function positionalArguments(argv) {
  const positionals = [];
  let skipNext = false;
  for (const [index, argument] of argv.entries()) {
    if (argument === '--') return [...positionals, ...argv.slice(index + 1)];
    if (skipNext) {
      skipNext = false;
    } else if (argument.startsWith('-')) {
      skipNext = valueTakingOptions.has(argument);
    } else {
      positionals.push(argument);
    }
  }
  return positionals;
}

export function hasCliFeaturePath(argv = process.argv.slice(2)) {
  return positionalArguments(argv).some(argument => isCliFeaturePathArgument(argument));
}

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

function buildLiveCucumberConfig(argv = process.argv.slice(2)) {
  return {
    ...buildCucumberConfig(argv),
    tags: liveTags,
  };
}

export const live = buildLiveCucumberConfig();

export default buildCucumberConfig();
