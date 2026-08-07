import nodePath from 'node:path';

export function publicFixtureEnvironment(
  fixtureDirectory: string,
  fixtureOverrides: Readonly<NodeJS.ProcessEnv>,
  inheritedEnvironment: Readonly<NodeJS.ProcessEnv> = process.env,
): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    ...inheritedEnvironment,
    SAFEWORD_NO_UPDATE_CHECK: '1',
    SAFEWORD_SKIP_INSTALL: '1',
    ...fixtureOverrides,
    CODEX_HOME: nodePath.join(fixtureDirectory, 'codex-profile'),
  };
  delete environment.NODE_OPTIONS;
  return environment;
}
