// Safeword: non-blocking ARCHITECTURE.md staleness nudge at the done-gate (AXRC4D,
// GitHub #559). When a ticket moved the project's top-level architecture shape — the
// fingerprint recorded in `<namespace>/architecture.generated.md` differs from the
// branch base — and a human-authored `ARCHITECTURE.md` exists, surface a one-line
// advisory that its module/layer narrative may be stale and should be reconciled
// (via `/audit`). It REUSES the existing fingerprint (the shapeFingerprint /
// monorepoFingerprint already written into the generated doc by the architecture
// subsystem) as a cheap trigger; it computes nothing from source, introduces no new
// detector, and NEVER blocks — `ARCHITECTURE.md` is human-owned, so only a person can
// fix narrative drift. Anchoring on the generated doc keeps the trigger
// deterministic-by-reading rather than model-guessed.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { resolveNamespaceRoot } from './namespace-root.js';

/** The generated state-document filename, colocated at the namespace root for the top level. */
const GENERATED_DOC = 'architecture.generated.md';
/** The human-authored architecture narrative at the project root. */
const ARCHITECTURE_MD = 'ARCHITECTURE.md';

/** The one-line, non-blocking advisory surfaced at the done-gate when the shape moved. */
export const ARCHITECTURE_DOCUMENT_NUDGE =
  'ARCHITECTURE.md may be stale: this ticket moved the top-level architecture shape ' +
  '(the generated module/package map changed). ARCHITECTURE.md is human-owned and was ' +
  'not touched — run `/audit` to reconcile its module/layer description against ' +
  '`architecture.generated.md`. Advisory only; nothing is blocked.';

function runGit(cwd: string, args: string[]): string {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    // Outside a git repo, git unavailable, or the ref/path is absent: no baseline.
    return '';
  }
}

/**
 * The `fingerprint:` value from a generated-doc's frontmatter, or `undefined` when the
 * content is empty, has no frontmatter, or carries no fingerprint line. CRLF-tolerant.
 */
export function parseGeneratedFingerprint(content: string): string | undefined {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content)?.[1];
  if (frontmatter === undefined) return undefined;
  for (const line of frontmatter.split(/\r?\n/)) {
    if (line.startsWith('fingerprint:')) {
      const value = line.slice('fingerprint:'.length).trim();
      return value.length > 0 ? value : undefined;
    }
  }
  return undefined;
}

/** Inputs the pure nudge decision depends on — gathered from disk + git by the caller. */
export interface ArchitectureDocumentNudgeInputs {
  /** Whether a human `ARCHITECTURE.md` exists at the project root. */
  architectureMdExists: boolean;
  /** The generated doc's fingerprint at the branch base, or `undefined` (doc absent at base). */
  baseFingerprint: string | undefined;
  /** The generated doc's fingerprint in the working tree, or `undefined` (no generated doc). */
  currentFingerprint: string | undefined;
}

/**
 * The done-gate nudge string, or `null` when none is warranted. Pure — the IO seam lives
 * in {@link architectureDocumentNudgeForProject}. Fires only when (1) a human
 * `ARCHITECTURE.md` exists (the audit create-from-template path owns the absent case), (2)
 * a generated shape doc exists now, and (3) the fingerprint moved vs the base — including
 * the "shape map newly introduced this ticket" case (`baseFingerprint === undefined`). A
 * ticket that left the top-level fingerprint unchanged emits nothing (no false alarm).
 */
export function architectureDocumentNudge(inputs: ArchitectureDocumentNudgeInputs): string | null {
  if (!inputs.architectureMdExists) return null;
  if (inputs.currentFingerprint === undefined) return null;
  if (inputs.baseFingerprint === inputs.currentFingerprint) return null;
  return ARCHITECTURE_DOCUMENT_NUDGE;
}

/**
 * Resolve {@link architectureDocumentNudge}'s inputs from `projectDir` + git, then return
 * the nudge (or `null`). The branch base is the merge-base with the upstream/default
 * branch; when it can't be resolved we return `null` rather than guess (no false alarm on
 * an unknowable baseline). `projectDir` is the repo root (the done-gate's cwd).
 */
export function architectureDocumentNudgeForProject(projectDir: string): string | null {
  // Cheap exit before any git/fs work: no human doc ⇒ nothing to reconcile against.
  if (!existsSync(nodePath.join(projectDir, ARCHITECTURE_MD))) return null;

  const generatedPath = nodePath.join(resolveNamespaceRoot(projectDir), GENERATED_DOC);
  const currentFingerprint = existsSync(generatedPath)
    ? parseGeneratedFingerprint(readFileSync(generatedPath, 'utf8'))
    : undefined;
  if (currentFingerprint === undefined) return null;

  const baseRef = resolveBaseRef(projectDir);
  if (baseRef === undefined) return null; // unknowable baseline → don't guess

  const relativeDocPath = nodePath.relative(projectDir, generatedPath);
  const baseDoc = runGit(projectDir, ['show', `${baseRef}:${relativeDocPath}`]);
  const baseFingerprint = baseDoc === '' ? undefined : parseGeneratedFingerprint(baseDoc);

  return architectureDocumentNudge({
    architectureMdExists: true,
    baseFingerprint,
    currentFingerprint,
  });
}

/** The merge-base of HEAD with the upstream/default branch — the ticket's divergence point. */
function resolveBaseRef(cwd: string): string | undefined {
  const upstream = runGit(cwd, [
    'rev-parse',
    '--abbrev-ref',
    '--symbolic-full-name',
    '@{u}',
  ]).trim();
  if (upstream === '') return undefined;
  const mergeBase = runGit(cwd, ['merge-base', 'HEAD', upstream]).trim();
  return mergeBase === '' ? undefined : mergeBase;
}
