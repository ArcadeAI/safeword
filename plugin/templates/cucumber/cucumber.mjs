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

// Cucumber options that take a value (`--name <REGEXP>`, `-f <TYPE>`). That
// value is never a feature path, even when it ends in `.feature`; the
// `--option=value` form is a single argument and needs no special case.
const valueTakingLongOptions = new Set([
  '--config',
  '--format',
  '--format-options',
  '--i18n-keywords',
  '--import',
  '--loader',
  '--language',
  '--name',
  '--order',
  '--profile',
  '--parallel',
  '--plugin',
  '--plugin-options',
  '--require',
  '--require-module',
  '--retry',
  '--retry-tag-filter',
  '--shard',
  '--tags',
  '--world-parameters',
]);
// Short flags `-c -f -i -l -p -r -t` take a value. In a cluster (`-df`), the
// first value-taking flag takes the rest of the cluster as its value
// (`-fsummary`), or the next argument when it is the cluster's last flag.
const shortClusterEndingInValueFlag = /^-[^cfilprt]*[cfilprt]$/;

// Whether an option argument consumes the next argument as its value.
function consumesNextArgument(option) {
  if (option.startsWith('--')) return valueTakingLongOptions.has(option);
  return shortClusterEndingInValueFlag.test(option);
}

// Cucumber reads every positional argument as a feature path (a file, a
// directory, a glob, or `file.feature:12`): everything except options and
// their values, plus every argument after a bare `--`.
function positionalArguments(argv) {
  const positionals = [];
  let skipNext = false;
  for (const [index, argument] of argv.entries()) {
    if (argument === '--') return [...positionals, ...argv.slice(index + 1)];
    if (skipNext) {
      skipNext = false;
    } else if (argument.startsWith('-')) {
      skipNext = consumesNextArgument(argument);
    } else {
      positionals.push(argument);
    }
  }
  return positionals;
}

// Any CLI feature path replaces the default globs, so a targeted run never
// picks up unselected scenarios.
export function hasCliFeaturePath(argv = process.argv.slice(2)) {
  return positionalArguments(argv).length > 0;
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
