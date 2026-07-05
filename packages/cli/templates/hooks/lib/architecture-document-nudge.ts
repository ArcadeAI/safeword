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
/** The default human-authored architecture narrative at the project root. */
const ARCHITECTURE_MD = 'ARCHITECTURE.md';

/** The frontmatter key holding the recorded shape fingerprint (mirrors the CLI writer). */
const FINGERPRINT_KEY = 'fingerprint';

/**
 * The resolved architecture narrative location (ticket BY7RNR, GitHub #848).
 * Standalone copy of the CLI's `resolveArchitectureNarrative` in
 * `src/utils/configured-paths.ts` — hooks run under bun in customer repos with
 * no import path to the CLI. A differential test pins the two (P58R22).
 */
export interface HookArchitectureNarrative {
  /** Absolute path of the narrative target. Existence is NOT guaranteed. */
  absolutePath: string;
  /** Human-facing name: the as-written config value, or `ARCHITECTURE.md`. */
  displayPath: string;
}

/**
 * Resolve the narrative: a non-empty `paths.architecture` in
 * `.safeword/config.json` wins outright — even when its target is missing on
 * disk, never hunting back to a root file the host deliberately moved away
 * from — else root `ARCHITECTURE.md`. Missing/unparseable config or an
 * empty-string value behaves as unconfigured.
 */
export function resolveArchitectureNarrative(projectDir: string): HookArchitectureNarrative {
  const configured = readConfiguredArchitecturePath(projectDir);
  if (configured !== undefined) {
    return {
      absolutePath: nodePath.isAbsolute(configured)
        ? configured
        : nodePath.join(projectDir, configured),
      displayPath: configured,
    };
  }
  return {
    absolutePath: nodePath.join(projectDir, ARCHITECTURE_MD),
    displayPath: ARCHITECTURE_MD,
  };
}

/** The raw non-empty `paths.architecture` string, or `undefined` (unset, empty, non-string, or unreadable config). */
function readConfiguredArchitecturePath(projectDir: string): string | undefined {
  const configPath = nodePath.join(projectDir, '.safeword', 'config.json');
  if (!existsSync(configPath)) return undefined;

  let parsed: { paths?: { architecture?: unknown } };
  try {
    parsed = JSON.parse(readFileSync(configPath, 'utf8')) as {
      paths?: { architecture?: unknown };
    };
  } catch {
    return undefined;
  }

  const raw = parsed.paths?.architecture;
  if (typeof raw !== 'string' || raw.length === 0) return undefined;
  return raw;
}

/** The one-line, non-blocking advisory surfaced at the done-gate when the shape moved. */
export function architectureDocumentNudgeText(narrativeDisplayPath: string): string {
  return (
    `Architecture narrative (${narrativeDisplayPath}) may be stale: this ticket moved ` +
    'the top-level architecture shape (the generated module/package map changed). ' +
    `${narrativeDisplayPath} is human-owned and was not touched — run \`/audit\` to ` +
    'reconcile its module/layer description against `architecture.generated.md`. ' +
    'Advisory only; nothing is blocked.'
  );
}

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
    if (line.startsWith(`${FINGERPRINT_KEY}:`)) {
      const value = line.slice(FINGERPRINT_KEY.length + 1).trim();
      return value.length > 0 ? value : undefined;
    }
  }
  return undefined;
}

/** Inputs the pure nudge decision depends on — gathered from disk + git by the caller. */
export interface ArchitectureDocumentNudgeInputs {
  /** Whether the resolved narrative (configured or root fallback) exists on disk. */
  narrativeExists: boolean;
  /** Human-facing name of the resolved narrative, for the advisory text. */
  narrativeDisplayPath: string;
  /** The generated doc's fingerprint at the branch base, or `undefined` (doc absent at base). */
  baseFingerprint: string | undefined;
  /** The generated doc's fingerprint in the working tree, or `undefined` (no generated doc). */
  currentFingerprint: string | undefined;
}

/**
 * The done-gate nudge string, or `null` when none is warranted. Pure — the IO seam lives
 * in {@link architectureDocumentNudgeForProject}. Fires only when (1) the resolved
 * narrative exists (the audit create-from-template path owns the absent case), (2)
 * a generated shape doc exists now, and (3) the fingerprint moved vs the base — including
 * the "shape map newly introduced this ticket" case (`baseFingerprint === undefined`). A
 * ticket that left the top-level fingerprint unchanged emits nothing (no false alarm).
 */
export function architectureDocumentNudge(inputs: ArchitectureDocumentNudgeInputs): string | null {
  if (!inputs.narrativeExists) return null;
  if (inputs.currentFingerprint === undefined) return null;
  if (inputs.baseFingerprint === inputs.currentFingerprint) return null;
  return architectureDocumentNudgeText(inputs.narrativeDisplayPath);
}

/**
 * Resolve {@link architectureDocumentNudge}'s inputs from `projectDir` + git, then return
 * the nudge (or `null`). The narrative resolves via `paths.architecture` (root
 * `ARCHITECTURE.md` fallback). The branch base is the merge-base with the upstream/default
 * branch; when it can't be resolved we return `null` rather than guess (no false alarm on
 * an unknowable baseline). `projectDir` is the repo root (the done-gate's cwd).
 */
export function architectureDocumentNudgeForProject(projectDir: string): string | null {
  // Cheap exit before any git/fs work: no narrative ⇒ nothing to reconcile against.
  // An empty configured ADR directory counts as a narrative here (existsSync) even
  // though the CLI drift advisory treats it as none (zero records to scan) — the
  // nudge only points a human at /audit, which is still the right pointer there.
  const narrative = resolveArchitectureNarrative(projectDir);
  if (!existsSync(narrative.absolutePath)) return null;

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
    narrativeExists: true,
    narrativeDisplayPath: narrative.displayPath,
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
