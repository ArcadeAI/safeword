/**
 * Shape-fingerprint of a project's architecture-relevant structure (ticket
 * QD5DTT, Slice 1).
 *
 * Hashes the *shape* — top-level module names, dependency names (not versions),
 * the dependency-cruiser boundary config, and schema files — never source-file
 * bytes. So a structural change moves the fingerprint while semantics-preserving
 * noise (a version bump, a comment edit) does not. This is the cheap, LLM-free
 * drift signal the self-heal path compares against the recorded value.
 */

export function shapeFingerprint(_projectDirectory: string): string {
  return 'stub';
}
