import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

describe.each([
  ['canonical template', '../../templates/'],
  ['dogfood copy', '../../../../.safeword/'],
])('feature intake handoff — %s', (_label, root) => {
  function read(file: string): string {
    return readFileSync(fileURLToPath(new URL(root + file, import.meta.url)), 'utf8');
  }

  it('routes new capabilities to the guide that defines jobs for each persona', () => {
    expect(read('SAFEWORD.md')).toMatch(/new capability, invoke the native `safeword:bdd` skill/iu);
    expect(read('skills/bdd/SKILL.md')).toContain('[DISCOVERY.md](DISCOVERY.md)');
    const discovery = read('skills/bdd/DISCOVERY.md');
    expect(discovery).toContain('### Jobs To Be Done');
    expect(discovery).toContain('Use one persona per JTBD');
  });
});
