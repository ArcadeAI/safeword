import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { SAFEWORD_SCHEMA } from '../../src/schema.js';

export interface FakeCodexRuntime {
  bin: string;
  codexHome: string;
  logPath: string;
}

interface FakeCodexRuntimeOptions {
  pluginEnabled: boolean;
  pluginInitiallyInstalled: boolean;
  pluginVersion?: string;
}

function writeExecutable(path: string, content: string): void {
  writeFileSync(path, content, { mode: 0o755 });
  chmodSync(path, 0o755);
}

export function installFakeCodexRuntime(
  directory: string,
  { pluginEnabled, pluginInitiallyInstalled, pluginVersion }: FakeCodexRuntimeOptions,
): FakeCodexRuntime {
  const bin = nodePath.join(directory, 'bin');
  const codexHome = nodePath.join(directory, 'profile');
  const logPath = nodePath.join(directory, 'codex.log');
  const pluginState = nodePath.join(codexHome, 'plugin-state');
  const pluginVersionState = nodePath.join(codexHome, 'plugin-version');
  mkdirSync(bin, { recursive: true });
  mkdirSync(codexHome, { recursive: true });
  let initialPluginState = 'absent';
  if (pluginInitiallyInstalled) initialPluginState = pluginEnabled ? 'enabled' : 'disabled';
  writeFileSync(pluginState, initialPluginState);
  writeFileSync(pluginVersionState, pluginVersion ?? '');
  writeExecutable(nodePath.join(bin, 'bun'), '#!/bin/sh\nexit 0\n');
  writeExecutable(
    nodePath.join(bin, 'codex'),
    String.raw`#!/bin/sh
set -eu
printf '%s\n' "$*" >> "$SAFEWORD_CODEX_LOG"
if [ "$(printenv SAFEWORD_MUTATE_CONFIG 2>/dev/null || true)" = "1" ] && [ "$*" = "plugin list --json" ]; then
  printf '# concurrent config update\\n' >> "$SAFEWORD_CONFIG_PATH"
fi
if [ -n "$(printenv SAFEWORD_LEGACY_ASSET_PATH 2>/dev/null || true)" ] && [ "$*" = "plugin list --json" ]; then
  printf '# appeared after confirmation\n' > "$SAFEWORD_LEGACY_ASSET_PATH"
fi
case "$*" in
  '--version') echo 'codex 0.141.0' ;;
  'plugin marketplace list --json')
    if [ "$(printenv SAFEWORD_FAIL_MARKETPLACE_LIST 2>/dev/null || true)" = "1" ]; then
      echo 'marketplace observation failed' >&2
      exit 7
    fi
    if [ "$(printenv SAFEWORD_MALFORMED_MARKETPLACE_LIST 2>/dev/null || true)" = "1" ]; then
      echo '{bad json'
    elif [ "$(printenv SAFEWORD_UNSUPPORTED_MARKETPLACE_LIST 2>/dev/null || true)" = "1" ]; then
      echo '{"marketplaces":[null]}'
    elif [ "$(printenv SAFEWORD_MARKETPLACE_SOURCE_TYPE 2>/dev/null || true)" = "local" ]; then
      echo '{"marketplaces":[{"name":"safeword","marketplaceSource":{"sourceType":"local","source":"/tmp/safeword"}}]}'
    elif [ "$(printenv SAFEWORD_MISMATCHED_GIT_MARKETPLACE 2>/dev/null || true)" = "1" ]; then
      echo '{"marketplaces":[{"name":"safeword","marketplaceSource":{"sourceType":"git","source":"https://example.com/untrusted/safeword.git"}}]}'
    elif [ "$(printenv SAFEWORD_SSH_GIT_MARKETPLACE 2>/dev/null || true)" = "1" ]; then
      echo '{"marketplaces":[{"name":"safeword","marketplaceSource":{"sourceType":"git","source":"git@github.com:ArcadeAI/safeword.git"}}]}'
    elif [ '${pluginInitiallyInstalled}' = 'true' ]; then
      echo '{"marketplaces":[{"name":"safeword","marketplaceSource":{"sourceType":"git","source":"https://github.com/ArcadeAI/safeword.git"}}]}'
    else
      echo '{"marketplaces":[]}'
    fi
    ;;
  'plugin marketplace upgrade safeword --json')
    if [ "$(printenv SAFEWORD_FAIL_MARKETPLACE_UPGRADE 2>/dev/null || true)" = "1" ]; then
      echo 'marketplace refresh failed' >&2
      exit 6
    fi
    echo '{"marketplaceName":"safeword"}'
    ;;
  'plugin marketplace remove safeword --json')
    echo '{"marketplaceName":"safeword"}'
    ;;
  'plugin marketplace add '* )
    if [ "$(printenv SAFEWORD_FAIL_PLUGIN_INSTALL 2>/dev/null || true)" = "1" ]; then
      echo 'marketplace unavailable' >&2
      exit 9
    fi
    echo '{"marketplaceName":"safeword"}'
    ;;
  'plugin add safeword@safeword --json')
    printf 'enabled' > '${pluginState}'
    printf '${SAFEWORD_SCHEMA.version}' > '${pluginVersionState}'
    echo '{"pluginId":"safeword@safeword"}'
    ;;
  'plugin list --json')
    if [ "$(printenv SAFEWORD_FAIL_PLUGIN_VERIFY 2>/dev/null || true)" = "1" ]; then
      echo 'profile observation failed' >&2
      exit 8
    fi
    mode="$(cat '${pluginState}')"
    if [ "$mode" = "absent" ]; then
      echo '{"installed":[]}'
    elif [ "$mode" = "disabled" ]; then
      echo '{"installed":[{"pluginId":"safeword@safeword","enabled":false}]}'
    else
      version="$(cat '${pluginVersionState}')"
      if [ -n "$version" ]; then
        echo "{\"installed\":[{\"pluginId\":\"safeword@safeword\",\"enabled\":true,\"version\":\"$version\"}]}"
      else
        echo '{"installed":[{"pluginId":"safeword@safeword","enabled":true}]}'
      fi
    fi
    ;;
  *) exit 2 ;;
esac
`,
  );

  return { bin, codexHome, logPath };
}
