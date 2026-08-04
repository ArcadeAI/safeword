import { type CliResult, createResult } from '../cli-protocol/result.js';
import { codexPluginVersionMatchesPackage } from '../codex-plugin/migration.js';
import { codexSessionProofIsCurrent } from '../codex-plugin/profile-proof.js';
import { installCodexPlugin, observeCodexMigrationResult } from './migrate-codex-plugin.js';

interface SessionStartInput {
  session_id?: string;
}

const RETRY_COMMAND = 'bunx --bun safeword@latest codex install';

function sessionIdFromInput(rawInput: string): string | undefined {
  try {
    const sessionId = (JSON.parse(rawInput) as SessionStartInput).session_id?.trim();
    return sessionId === '' ? undefined : sessionId;
  } catch {
    return undefined;
  }
}

function additionalContext(message: string): string {
  return `${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: message,
    },
  })}\n`;
}

function hookResult(
  body: string,
  options: { changed?: boolean; installed?: boolean; reason: string },
): CliResult {
  return createResult({
    state: options.changed === true ? 'changed' : 'healthy',
    changed: options.changed,
    effects:
      options.changed === true
        ? {
            configuration: [{ kind: 'enable', target: 'Safeword Codex profile plugin' }],
            network: [{ kind: 'fetch', target: 'Safeword stable Codex marketplace' }],
          }
        : undefined,
    presentation: { kind: 'raw', body },
    data: {
      command: 'codex bootstrap',
      protected_in_current_task: options.reason === 'current',
      profile_plugin_installed: options.installed,
      reason: options.reason,
    },
  });
}

function plainFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message
      .replaceAll(/`[^`]+`/gu, 'the install command')
      .split('\n', 1)
      .at(0)
      ?.trim() ?? 'unknown installation failure'
  );
}

function profilePluginIsCurrent(
  cwd: string,
  environment: NodeJS.ProcessEnv,
  observe: typeof observeCodexMigrationResult,
): boolean {
  try {
    const plugin = observe(cwd, environment).plugin;
    return plugin.enabled === true && codexPluginVersionMatchesPackage(plugin);
  } catch {
    return false;
  }
}

function installProfilePlugin(
  cwd: string,
  environment: NodeJS.ProcessEnv,
  install: typeof installCodexPlugin,
): { installed: true } | { installed: false; error: unknown } {
  try {
    install({ cwd, environment, json: true, reportMigrationState: false });
    return { installed: true };
  } catch (error) {
    return { installed: false, error };
  }
}

// eslint-disable-next-line complexity -- one fail-open boundary coordinates task proof, offline mode, profile observation, and installation
export function bootstrapCodexPlugin(
  cwd: string,
  rawInput: string,
  options: {
    environment?: NodeJS.ProcessEnv;
    offline?: boolean;
    observe?: typeof observeCodexMigrationResult;
    install?: typeof installCodexPlugin;
  } = {},
): CliResult {
  const environment = options.environment ?? process.env;
  const sessionId = sessionIdFromInput(rawInput);
  if (sessionId && codexSessionProofIsCurrent(cwd, sessionId, environment)) {
    return hookResult('', { installed: true, reason: 'current' });
  }

  const observe = options.observe ?? observeCodexMigrationResult;
  const install = options.install ?? installCodexPlugin;
  let profileCurrent = profilePluginIsCurrent(cwd, environment, observe);

  let installed = false;
  if (!profileCurrent && options.offline !== true) {
    const installation = installProfilePlugin(cwd, environment, install);
    if (installation.installed) {
      installed = true;
      profileCurrent = true;
    } else {
      return hookResult(
        additionalContext(
          `SAFEWORD IS NOT ACTIVE IN THIS TASK. You can continue working, but Safeword will not protect this task. Automatic profile installation failed: ${plainFailure(installation.error)}. Retry once with: ${RETRY_COMMAND}`,
        ),
        { installed: false, reason: 'install-failed' },
      );
    }
  }

  if (!profileCurrent) {
    return hookResult(
      additionalContext(
        'SAFEWORD IS NOT ACTIVE IN THIS TASK. You can continue working, but Safeword will not protect this task. Automatic profile installation was skipped because Codex is offline. Start a new online Codex task in this repository to install and activate Safeword.',
      ),
      { installed: false, reason: 'offline' },
    );
  }

  return hookResult(
    additionalContext(
      'SAFEWORD IS NOT ACTIVE IN THIS TASK. You can continue working, but Safeword will not protect this task. Safeword is installed for your Codex profile. Start a new Codex task in this repository to work with Safeword active.',
    ),
    { changed: installed, installed: true, reason: installed ? 'installed' : 'restart-required' },
  );
}
