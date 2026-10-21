import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { claudeAssetMatches, claudeSkillSha256 } from '../../src/claude-plugin/asset-integrity.js';

const path = 'skills/audit/SKILL.md';
const original =
  '---\nname: audit\ndescription: Run a diff-scoped code audit for architecture, dead code, and test\n  quality.\noptions: {enabled: true, tools: [Read, Bash]}\n---\n\n# Audit\n';
const normalized =
  '---\noptions: {tools: [Read, Bash], enabled: true}\ndescription: "Run a diff-scoped code audit for architecture, dead code, and test quality."\nname: audit\n---\n\n# Audit\n';
const asset = {
  path,
  sha256: createHash('sha256').update(original).digest('hex'),
  skill_sha256: claudeSkillSha256(path, original),
};

describe('Claude skill integrity', () => {
  it('accepts folded scalars, quoting, and reordered mapping keys without ignoring metadata', () => {
    expect(claudeAssetMatches(asset, Buffer.from(normalized))).toBe(true);
    expect(claudeAssetMatches(asset, Buffer.from(original))).toBe(true);
  });

  it.each([
    normalized.replace('name: audit', 'name: changed'),
    normalized.replace('enabled: true', 'enabled: "true"'),
    normalized.replace('[Read, Bash]', '[Bash, Read]'),
    normalized.replace('name: audit', 'name: audit\nallowed-tools: Bash'),
    normalized.replace('# Audit', '# Changed'),
    normalized.replace('# Audit', '# Audit '),
    normalized.slice(0, -1),
    normalized.replace('\n# Audit\n', '\r\n# Audit\r\n'),
  ])('rejects changed metadata or body bytes (%#)', changed => {
    expect(claudeAssetMatches(asset, Buffer.from(changed))).toBe(false);
  });

  it.each([
    'name: audit\nname: audit',
    'name: [unterminated',
    '- audit',
    'audit',
    'name: !unknown audit',
    'name: &name audit\ndescription: *name',
    'name: .nan',
    '1: audit',
  ])('rejects ambiguous or malformed front matter (%#)', header => {
    expect(() =>
      claudeAssetMatches(asset, Buffer.from(`---\n${header}\n---\n\n# Audit\n`)),
    ).toThrow();
  });

  it.each(['# Audit\n', '---\nname: audit\n--\n# Audit\n'])(
    'rejects missing delimiters (%#)',
    content => {
      expect(() => claudeAssetMatches(asset, Buffer.from(content))).toThrow();
    },
  );

  it('rejects invalid UTF-8 rather than replacing changed body bytes', () => {
    expect(() =>
      claudeAssetMatches(asset, Buffer.concat([Buffer.from(normalized), Buffer.from([255])])),
    ).toThrow('not valid UTF-8');
  });

  it('keeps older inventories strict when they have no semantic digest', () => {
    const legacy = { path, sha256: asset.sha256 };
    expect(claudeAssetMatches(legacy, Buffer.from(original))).toBe(true);
    expect(claudeAssetMatches(legacy, Buffer.from(normalized))).toBe(false);
  });

  it.each(['runtime/cli.js', 'templates/skills/audit/SKILL.md', 'resources/example.md'])(
    'keeps non-exposed assets byte-exact: %s',
    otherPath => {
      expect(claudeSkillSha256(otherPath, original)).toBeUndefined();
      expect(claudeAssetMatches({ ...asset, path: otherPath }, Buffer.from(normalized))).toBe(
        false,
      );
    },
  );
});
