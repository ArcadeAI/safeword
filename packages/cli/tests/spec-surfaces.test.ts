import { describe, expect, it } from 'vitest';

import { readRepoFile as read } from './helpers';

// #3622 kept Product Plans lean by banning a Surfaces section outright. But
// SCENARIOS, health.ts and /verify all read `spec.md ## Surfaces`, so the ban
// left three checks that no conforming spec could ever satisfy.
//
// The section now exists, and #3622's concern is preserved as the property that
// actually made a fifth section costly: whether it obliges the author to write
// anything. Everything under the heading is commented guidance, so a spec that
// ignores Surfaces is exactly as short as it was before. Guidance may grow or
// shrink freely; what must not appear is prose the author is expected to fill in.
const TEMPLATES = [
  'packages/cli/templates/spec-template.md',
  'packages/cli/templates/child-spec-template.md',
];

function surfacesSection(template: string): string {
  const start = template.indexOf('## Surfaces');
  if (start === -1) return '';
  const next = template.indexOf('\n## ', start + 1);
  return next === -1 ? template.slice(start) : template.slice(start, next);
}

describe('lean Product Plan surface guidance', () => {
  it.each(TEMPLATES)('%s carries a Surfaces section the readers can find', relative => {
    expect(surfacesSection(read(relative))).toContain('Affected:');
  });

  it.each(TEMPLATES)('%s asks the author for nothing outside comments', relative => {
    const uncommented = surfacesSection(read(relative))
      .replaceAll(/<!--[\s\S]*?-->/gu, '')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line !== '' && line !== '## Surfaces');

    expect(uncommented).toEqual([]);
  });

  it('keeps surface selection in intake guidance', () => {
    const discovery = read('packages/cli/templates/skills/bdd/DISCOVERY.md');
    expect(discovery).toContain('paths.surfaces');
    expect(discovery).toContain('@surface.<slug>');
  });
});
