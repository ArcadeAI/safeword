import { describe, expect, it } from 'vitest';

import { golangPack } from '../../src/packs/golang/index.js';
import { GOLANG_SKILL_DIR_PATTERN } from '../../src/packs/golang/skills.js';
// Differential parity test (drift vector V1). The standalone hook lib re-encodes
// two facts the Go langpack owns — the `.go` extension and the `golang` skill-dir
// prefix — because deployed hooks run from .safeword/hooks/ with no access to the
// CLI dist (same rationale as parser-parity.test.ts). This pins the hook's copies
// to the langpack source of truth: change the prefix/extension on one side only
// and this fails loudly, instead of the nudge silently never firing.
import { SKILL_LANGUAGES } from '../../templates/hooks/lib/skill-nudge.js';

describe('golang skill-nudge ↔ langpack parity', () => {
  const goEntry = SKILL_LANGUAGES['.go'];

  it('the hook registers a .go entry', () => {
    expect(goEntry).toBeDefined();
  });

  it('the hook .go extension is one the langpack actually detects', () => {
    expect(golangPack.extensions).toContain('.go');
  });

  it('the hook prefix matches the langpack installed-dir pattern', () => {
    if (!goEntry) throw new Error('Go entry must exist');
    // A dir built from the hook's prefix must be recognized by the langpack's
    // GOLANG_SKILL_DIR_PATTERN — i.e. both sides agree the prefix is `golang`.
    expect(GOLANG_SKILL_DIR_PATTERN.test(`${goEntry.prefix}-context`)).toBe(true);
  });

  it('has teeth: a wrong prefix would NOT match the langpack pattern', () => {
    // Guards against a vacuous pass — proves the assertion above can fail.
    expect(GOLANG_SKILL_DIR_PATTERN.test('go-context')).toBe(false);
  });
});
