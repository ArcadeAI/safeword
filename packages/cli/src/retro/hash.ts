import { createHash } from 'node:crypto';

/**
 * The retro short-hash: a 12-hex-char SHA-256 digest of `material`. One
 * definition for both stable keys derived from a finding — the `retro:`
 * signature and the manifestation key — so the algorithm and length live in a
 * single place.
 */
export function shortHash(material: string): string {
  return createHash('sha256').update(material).digest('hex').slice(0, 12);
}
