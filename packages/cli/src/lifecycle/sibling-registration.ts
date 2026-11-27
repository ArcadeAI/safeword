import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import nodePath from 'node:path';

import { parse } from 'smol-toml';

import { CLAUDE_PLUGIN_ID } from '../claude-plugin/inventory.js';
import { claudeConfigDirectory } from '../claude-plugin/plugin-data.js';
import { canonicalDirectory } from '../utils/fs.js';

/** A missing registry has no owner. Unreadable or invalid ownership data cannot authorize cleanup. */
function retainsSharedFiles(file: string, registered: (text: string) => boolean): boolean {
  try {
    return registered(readFileSync(file, 'utf8'));
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ENOENT';
  }
}

export function claudeRetainsProject(
  cwd: string,
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  const file = nodePath.join(claudeConfigDirectory(environment), 'plugins/installed_plugins.json');
  return retainsSharedFiles(file, text => {
    const registry = JSON.parse(text);
    if (
      registry.version !== 2 ||
      !registry.plugins ||
      typeof registry.plugins !== 'object' ||
      Array.isArray(registry.plugins)
    )
      return true;
    const entries = registry.plugins[CLAUDE_PLUGIN_ID];
    if (entries === undefined) return false;
    if (!Array.isArray(entries)) return true;
    const project = canonicalDirectory(cwd);
    return entries.some(entry => {
      if (entry?.scope !== 'project' && entry?.scope !== 'local') return true;
      const registeredProject = canonicalDirectory(entry.projectPath);
      return registeredProject === undefined || registeredProject === project;
    });
  });
}

export function codexRetainsProject(environment: NodeJS.ProcessEnv = process.env): boolean {
  const file = nodePath.join(
    environment.CODEX_HOME ?? nodePath.join(homedir(), '.codex'),
    'config.toml',
  );
  return retainsSharedFiles(file, text => {
    const { plugins } = parse(text);
    if (plugins === undefined) return false;
    return (
      typeof plugins !== 'object' ||
      Array.isArray(plugins) ||
      Object.hasOwn(plugins, 'safeword@safeword')
    );
  });
}
