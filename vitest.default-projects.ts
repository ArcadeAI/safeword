export interface DefaultVitestProject {
  root: string;
  sourceDirectories: readonly string[];
  excludedSuffixes: readonly string[];
}

export const DEFAULT_VITEST_PROJECTS = [
  {
    root: 'packages/cli',
    sourceDirectories: ['tests', 'src'],
    excludedSuffixes: ['slow', 'release', 'live'],
  },
  {
    root: 'packages/retro-relay',
    sourceDirectories: ['tests'],
    excludedSuffixes: [],
  },
  {
    root: 'packages/retro-collector',
    sourceDirectories: ['tests'],
    excludedSuffixes: [],
  },
] as const satisfies readonly DefaultVitestProject[];

export function defaultVitestInclude(projectRoot: string): string[] {
  const project = DEFAULT_VITEST_PROJECTS.find(candidate => candidate.root === projectRoot);
  if (project === undefined) throw new TypeError(`Unknown default Vitest project: ${projectRoot}`);
  return project.sourceDirectories.map(directory => `${directory}/**/*.test.ts`);
}

export function defaultVitestExclude(projectRoot: string): string[] {
  const project = DEFAULT_VITEST_PROJECTS.find(candidate => candidate.root === projectRoot);
  if (project === undefined) throw new TypeError(`Unknown default Vitest project: ${projectRoot}`);
  return project.sourceDirectories.flatMap(directory =>
    project.excludedSuffixes.map(suffix => `${directory}/**/*.${suffix}.test.ts`),
  );
}
