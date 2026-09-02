import { describe, expect, it } from 'vitest';

import { readRepoFile as read } from './helpers';

describe('lean Product Plan surface guidance', () => {
  it('does not add a fifth top-level Surfaces section to Product Plans', () => {
    const spec = read('packages/cli/templates/spec-template.md');
    expect(spec).not.toContain('## Surfaces');
  });

  it('keeps surface selection in intake guidance', () => {
    const discovery = read('packages/cli/templates/skills/bdd/DISCOVERY.md');
    expect(discovery).toContain('paths.surfaces');
    expect(discovery).toContain('@surface.<slug>');
  });
});
