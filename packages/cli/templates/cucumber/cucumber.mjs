// cucumber-js config — safeword's BDD acceptance lane, separate from your unit
// tests. `tsx/esm` transpiles the TypeScript step definitions on the fly;
// `paths` are the Gherkin `.feature` files. Run via `npm run test:bdd` (or
// `bun run test:bdd`). Safeword owns this file; step definitions and features
// are yours.
import process from 'node:process';

const workspaceFeaturePaths = [
  'features/**/*.feature',
  'packages/*/features/**/*.feature',
  'apps/*/features/**/*.feature',
  'libs/*/features/**/*.feature',
  'modules/*/features/**/*.feature',
];

const workspaceStepImports = [
  'tsx/esm',
  'steps/**/*.ts',
  'packages/*/features/steps/**/*.ts',
  'apps/*/features/steps/**/*.ts',
  'libs/*/features/steps/**/*.ts',
  'modules/*/features/steps/**/*.ts',
];

const cliFeatureDirectories = new Set(['features', 'packages', 'apps', 'libs', 'modules']);

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
