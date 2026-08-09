import { mkdirSync } from 'node:fs';
import nodePath from 'node:path';

export function publicFixtureEnvironment(
  fixtureDirectory: string,
  fixtureOverrides: Readonly<NodeJS.ProcessEnv>,
  inheritedEnvironment: Readonly<NodeJS.ProcessEnv> = process.env,
): NodeJS.ProcessEnv {
  const claudeConfigDirectory = nodePath.join(fixtureDirectory, 'claude-profile');
  const codexHome = nodePath.join(fixtureDirectory, 'codex-profile');
  mkdirSync(claudeConfigDirectory, { recursive: true });
  mkdirSync(codexHome, { recursive: true });

  const environment: NodeJS.ProcessEnv = {
    ...inheritedEnvironment,
    SAFEWORD_NO_UPDATE_CHECK: '1',
    SAFEWORD_SKIP_INSTALL: '1',
    ...fixtureOverrides,
    CLAUDE_CONFIG_DIR: claudeConfigDirectory,
    CODEX_HOME: codexHome,
  };
  delete environment.NODE_OPTIONS;
  return environment;
}
