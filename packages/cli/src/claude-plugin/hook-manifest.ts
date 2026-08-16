/**
 * The Claude plugin's hook manifest, and the digest the runtime compares
 * against it.
 *
 * This lives apart from `catalogue.ts` on purpose. `catalogue.ts` imports
 * esbuild to bundle the dispatcher at build time, and `status.ts` /
 * `cleanup-command.ts` need only the manifest digest — so importing it from
 * there dragged esbuild's CommonJS client into `plugin/runtime/cli.js`, where
 * it can never run. That mattered for more than size: bundling a CommonJS
 * module makes Bun inline `__dirname` as an ABSOLUTE path, so the generated
 * bundle embedded whichever machine produced it and CI's byte-for-byte drift
 * gate could never pass. Keep build-time-only dependencies out of anything the
 * runtime imports.
 */

import { createHash } from 'node:crypto';

import { SETTINGS_HOOKS } from '../templates/config.js';

const PROJECT_HOOK_ROOT = '"$CLAUDE_PROJECT_DIR"/.safeword/hooks';
const PLUGIN_HOOK_ROOT = '"${CLAUDE_PLUGIN_ROOT}"/runtime/hooks';
const PLUGIN_DISPATCH = 'bun "${CLAUDE_PLUGIN_ROOT}"/runtime/dispatch.js';

export function adaptHookValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replaceAll(PROJECT_HOOK_ROOT, () => PLUGIN_HOOK_ROOT);
  }
  if (Array.isArray(value)) return value.map(child => adaptHookValue(child));
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, adaptHookValue(child)]),
  );
}

function wrapHookCommands(value: unknown, event: string): unknown {
  if (Array.isArray(value)) return value.map(child => wrapHookCommands(child, event));
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      key === 'command' && typeof child === 'string'
        ? `${PLUGIN_DISPATCH} ${event} -- ${child}`
        : wrapHookCommands(child, event),
    ]),
  );
}

export function pluginSessionStartEntries(adapted: Record<string, unknown>): unknown[] {
  return Array.isArray(adapted.SessionStart)
    ? adapted.SessionStart.filter(
        entry => !JSON.stringify(entry).includes('session-auto-upgrade.ts'),
      )
    : [];
}

function pluginHookEntries(
  event: string,
  entries: unknown,
  adapted: Record<string, unknown>,
): unknown {
  if (event === 'SessionStart') {
    return wrapHookCommands(pluginSessionStartEntries(adapted), event);
  }
  if (event === 'UserPromptSubmit') {
    return [
      {
        hooks: [
          {
            type: 'command',
            command: `${PLUGIN_DISPATCH} ${event} --event-group`,
          },
        ],
      },
    ];
  }
  return wrapHookCommands(entries, event);
}

function pluginHooks(): Record<string, unknown> {
  const adapted = adaptHookValue(SETTINGS_HOOKS) as Record<string, unknown>;
  const withSetup = {
    ...adapted,
    Setup: [{ matcher: 'init', hooks: [{ type: 'command', command: 'true' }] }],
  };
  return Object.fromEntries(
    Object.entries(withSetup).map(([event, entries]) => [
      event,
      pluginHookEntries(event, entries, adapted),
    ]),
  );
}

export function pluginHookManifest(): string {
  const hooks = pluginHooks();
  return `${JSON.stringify({ hooks }, undefined, 2)}\n`;
}

export function currentClaudePluginHookManifestSha256(): string {
  return createHash('sha256').update(pluginHookManifest()).digest('hex');
}
