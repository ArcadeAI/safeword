import { type CliResult, createResult } from '../cli-protocol/result.js';
import { codexPluginVersionMatchesPackage } from '../codex-plugin/migration.js';
import { installCodexPlugin, observeCodexMigrationResult } from '../codex-plugin/operations.js';
import {
  codexActivationIsPending,
  codexSessionProofIsCurrent,
} from '../codex-plugin/profile-proof.js';

interface SessionStartInput {
  session_id?: string;
}

const RETRY_COMMAND = 'bunx --bun safeword@latest codex install';
const UNVERIFIED_PROTECTION =
  'SAFEWORD PROTECTION IS UNVERIFIED IN THIS TASK. You can continue working, but current protection is unknown.';
const PROFILE_RESTART_REQUIRED =
  'Safeword is installed for your Codex profile, but this task has not verified the installed update. An older Safeword runtime may still be loaded. Restart Codex and start a new task before relying on the installed update.';
const PROFILE_PROOF_UNVERIFIED =
  'Safeword is installed for your Codex profile, but exact SessionStart proof for this task is not yet available. This evidence alone does not establish that a restart is required.';
const INSTALL_COMPLETED_RESTART_REQUIRED =
  'Safeword was installed for your Codex profile, but the newly installed runtime is not active in this already-open task. Restart Codex and start a new task before relying on the installed version.';

type ProfileCurrency = 'current' | 'needs-install' | 'unverified';

interface ProfileObservation {
  currency: ProfileCurrency;
  /** Current profile state only; it cannot prove what an already-open task loaded. */
  installed: boolean | undefined;
}

type UnverifiedReason =
  | 'install-failed'
  | 'install-unverified'
  | 'installed'
  | 'offline'
  | 'profile-unverified'
  | 'proof-unverified'
  | 'restart-required';

type HookResultOptions = {
  changed?: boolean;
  configurationChanged?: boolean;
  installed?: boolean;
  networkOperation?: 'attempted' | 'succeeded';
} & (
  | { verification: 'current'; reason: 'current' }
  | { verification: 'unverified'; reason: UnverifiedReason }
);

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

function hookResult(body: string, options: HookResultOptions): CliResult {
  const protectionIsCurrent = options.verification === 'current';
  return createResult({
    state: options.changed === true ? 'changed' : 'healthy',
    changed: options.changed,
    effects:
      options.configurationChanged === true || options.networkOperation !== undefined
        ? {
            configuration:
              options.configurationChanged === true
                ? [{ kind: 'enable', target: 'Safeword Codex profile plugin' }]
                : [],
            network:
              options.networkOperation === undefined
                ? []
                : [
                    {
                      kind: 'fetch',
                      target: 'Safeword stable Codex marketplace',
                      operation: options.networkOperation,
                    },
                  ],
          }
        : undefined,
    presentation: { kind: 'raw', body },
    data: {
      command: 'codex bootstrap',
      protected_in_current_task: protectionIsCurrent ? true : undefined,
      protection_verification: options.verification,
      profile_plugin_installed: options.installed,
      reason: options.reason,
    },
  });
}

function observeProfilePlugin(
  cwd: string,
  environment: NodeJS.ProcessEnv,
  observe: typeof observeCodexMigrationResult,
): ProfileObservation {
  try {
    const plugin = observe(cwd, environment).plugin;
    if (plugin.observation !== 'observed' || plugin.enabled === null) {
      return { currency: 'unverified', installed: undefined };
    }
    return {
      currency:
        plugin.enabled && codexPluginVersionMatchesPackage(plugin) ? 'current' : 'needs-install',
      installed: plugin.installed,
    };
  } catch {
    return { currency: 'unverified', installed: undefined };
  }
}

function installProfilePlugin(
  cwd: string,
  environment: NodeJS.ProcessEnv,
  install: typeof installCodexPlugin,
): boolean {
  try {
    install({ cwd, environment, json: true, reportMigrationState: false });
    return true;
  } catch {
    return false;
  }
}

function unverifiedContext(detail: string): string {
  return additionalContext(`${UNVERIFIED_PROTECTION} ${detail}`);
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
    return hookResult('', { reason: 'current', verification: 'current' });
  }

  const observe = options.observe ?? observeCodexMigrationResult;
  const install = options.install ?? installCodexPlugin;
  const before = observeProfilePlugin(cwd, environment, observe);

  if (before.currency === 'unverified') {
    return hookResult(
      unverifiedContext(
        `Safeword's Codex profile state could not be verified, so automatic installation was not attempted. Retry once with: ${RETRY_COMMAND}`,
      ),
      { reason: 'profile-unverified', verification: 'unverified' },
    );
  }

  if (before.currency === 'current') {
    const restartRequired = codexActivationIsPending(environment);
    return hookResult(
      unverifiedContext(restartRequired ? PROFILE_RESTART_REQUIRED : PROFILE_PROOF_UNVERIFIED),
      {
        installed: before.installed,
        reason: restartRequired ? 'restart-required' : 'proof-unverified',
        verification: 'unverified',
      },
    );
  }

  if (options.offline === true) {
    return hookResult(
      unverifiedContext(
        'Automatic profile installation was skipped because Codex is offline. Start a new online Codex task in this repository to install and activate the current Safeword version.',
      ),
      { installed: before.installed, reason: 'offline', verification: 'unverified' },
    );
  }

  const installation = installProfilePlugin(cwd, environment, install);
  if (!installation) {
    return hookResult(
      unverifiedContext(`Automatic profile installation failed. Retry once with: ${RETRY_COMMAND}`),
      {
        installed: before.installed,
        networkOperation: 'attempted',
        reason: 'install-failed',
        verification: 'unverified',
      },
    );
  }

  const after = observeProfilePlugin(cwd, environment, observe);
  if (after.currency !== 'current') {
    return hookResult(
      unverifiedContext(
        `Automatic profile installation completed, but the resulting profile state could not be verified. Retry once with: ${RETRY_COMMAND}`,
      ),
      {
        changed: true,
        installed: after.installed,
        networkOperation: 'succeeded',
        reason: 'install-unverified',
        verification: 'unverified',
      },
    );
  }

  return hookResult(unverifiedContext(INSTALL_COMPLETED_RESTART_REQUIRED), {
    changed: true,
    configurationChanged: true,
    installed: after.installed,
    networkOperation: 'succeeded',
    reason: 'installed',
    verification: 'unverified',
  });
}
