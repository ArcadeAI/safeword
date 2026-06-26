import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  loadRustCandidateSkill,
  reviewRustCandidateSkill,
  summarizeRustCandidateSkill,
} from '../src/candidate';

const repoRoot = join(import.meta.dirname, '../../../..');
const humanSeedSkillPath = join(
  repoRoot,
  'experiments/gepa-language-skills/rust/candidates/human-seed-rust/SKILL.md',
);
const distilledOwnershipSkillPath = join(
  repoRoot,
  'experiments/gepa-language-skills/rust/candidates/distilled-rust-ownership-v1/SKILL.md',
);

describe('Rust candidate skills', () => {
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  });

  it('loads the human seed skill and passes candidate review', () => {
    const result = reviewRustCandidateSkill(humanSeedSkillPath);

    expect(result.skill.id).toBe('human-seed-rust');
    expect(result.skill.metadata.description).toContain('Rust coding guidance');
    expect(result.review).toEqual({ accepted: true, blockers: [] });
    expect(summarizeRustCandidateSkill(result.skill)).toEqual({
      id: 'human-seed-rust',
      path: humanSeedSkillPath,
      description: result.skill.metadata.description,
    });
  });

  it('loads the provider-distilled ownership skill and passes candidate review', () => {
    const result = reviewRustCandidateSkill(distilledOwnershipSkillPath);

    expect(result.skill.id).toBe('distilled-rust-ownership-v1');
    expect(result.skill.body).toContain('Resolving Borrow-Checker Errors');
    expect(result.skill.body).toContain('E0382');
    expect(result.skill.text).not.toMatch(
      /\b(sharkdp\/fd|fd-cli-filesystem-bugfix|sourceArtifact|train|validation|heldout|GEPA|optimizer|mutation|npm|pytest|pip)\b/i,
    );
    expect(result.review).toEqual({ accepted: true, blockers: [] });
  });

  it('rejects malformed skill files before review', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'safeword-rust-candidate-'));
    const skillDir = join(tempDir, 'bad-rust');
    const skillPath = join(skillDir, 'SKILL.md');
    mkdirSync(skillDir);
    writeFileSync(skillPath, '# Missing frontmatter\n', 'utf8');

    expect(() => loadRustCandidateSkill(skillPath)).toThrow(/must start with YAML frontmatter/);
  });

  it('rejects skill files whose frontmatter name does not match the folder', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'safeword-rust-candidate-'));
    const skillDir = join(tempDir, 'human-seed-rust');
    const skillPath = join(skillDir, 'SKILL.md');
    mkdirSync(skillDir);
    writeFileSync(
      skillPath,
      [
        '---',
        'name: other-rust',
        'description: Rust guidance',
        '---',
        '',
        'Prefer focused tests.',
      ].join('\n'),
      'utf8',
    );

    expect(() => loadRustCandidateSkill(skillPath)).toThrow(
      /candidate skill name must match folder name/,
    );
  });
});
