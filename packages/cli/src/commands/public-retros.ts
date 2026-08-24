import { type CliResult, createResult } from '../cli-protocol/result.js';
import { setPublicRetroCollection } from '../retro/public-config.js';

export function configurePublicRetros(cwd: string, state: 'off' | 'on'): CliResult {
  const enabled = state === 'on';
  const changed = setPublicRetroCollection(cwd, enabled);
  return createResult({
    state: changed ? 'changed' : 'healthy',
    effects: changed
      ? { configuration: [{ kind: 'update', target: '.safeword/config.json' }] }
      : undefined,
    data: { command: 'project public-retros', enabled },
  });
}
