import { createHash } from 'node:crypto';

import { isMap, parseDocument } from 'yaml';

function canonicalValue(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(item => canonicalValue(item));
  if (value instanceof Map) {
    const entries = [...value];
    if (entries.some(([key]) => typeof key !== 'string')) {
      throw new TypeError('Skill metadata keys must be strings.');
    }
    return Object.fromEntries(
      entries
        .toSorted(([left], [right]) => {
          if (left === right) return 0;
          return left < right ? -1 : 1;
        })
        .map(([key, item]) => [key, canonicalValue(item)]),
    );
  }
  throw new TypeError('Skill metadata must contain JSON-compatible values.');
}

/** Hash YAML meaning and exact body bytes; desktop sync rewrites skill headers (#6004). */
export function claudeSkillSha256(path: string, content: Buffer | string): string | undefined {
  if (!/^skills\/[^/]+\/SKILL\.md$/u.test(path)) return undefined;
  const text = content.toString();
  if (Buffer.isBuffer(content) && !Buffer.from(text).equals(content)) {
    throw new TypeError(`Skill is not valid UTF-8: ${path}`);
  }
  const header = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(text);
  if (header === null) throw new TypeError(`Skill front matter is missing: ${path}`);
  const document = parseDocument(header[1] ?? '', {
    uniqueKeys: true,
    version: '1.2',
    schema: 'core',
  });
  if (document.errors.length > 0 || document.warnings.length > 0 || !isMap(document.contents)) {
    throw new TypeError(`Skill front matter is invalid: ${path}`);
  }
  const metadata = canonicalValue(document.toJS({ mapAsMap: true, maxAliasCount: 0 }));
  return createHash('sha256')
    .update(JSON.stringify([metadata, text.slice(header[0].length)]))
    .digest('hex');
}

export function claudeAssetMatches(
  asset: { readonly path: string; readonly sha256: string; readonly skill_sha256?: unknown },
  content: Buffer,
): boolean {
  if (createHash('sha256').update(content).digest('hex') === asset.sha256) return true;
  if (typeof asset.skill_sha256 !== 'string' || !/^[\da-f]{64}$/u.test(asset.skill_sha256)) {
    return false;
  }
  return claudeSkillSha256(asset.path, content) === asset.skill_sha256;
}
