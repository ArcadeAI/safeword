/**
 * Autonomy-policy resolver — the pure core of the configurable HITL spine
 * (ticket HPQ43R, epic 90AZDV).
 *
 * A team sets where safeword pauses for human review ("ask") and where it
 * runs autonomously, per decision *axis*, by choosing a named *preset*. A
 * personal override layers on top of the project policy and wins on conflict.
 *
 * Every resolution path is fail-safe: an unknown preset, an invalid posture
 * or axis in an override, or a malformed policy object never silently grants
 * autonomy — it falls back toward the most human-in-the-loop result (Full
 * review for a broken project policy; the project policy for a broken
 * personal override). Autonomy is always opt-in.
 *
 * This module is intentionally filesystem-free so it is unit-testable without
 * an agent session (SM1.AC3). Reading `.safeword/config.json` and the
 * gitignored personal override is a thin caller on top of `resolvePolicy`.
 */

/** The decision kinds a posture can govern. External side-effects is not an
 * axis — the denylist is its floor, enforced independently of posture. */
export const AXES = [
  'intent-and-scope',
  'behavioral-contract',
  'irreversible-design',
  'execution',
  'completion',
] as const;

export type Axis = (typeof AXES)[number];

/** What an axis is set to. `autonomous` means the agent resolves the
 * breakpoint itself (then logs it); `ask` means it pauses for the human. */
export type Posture = 'ask' | 'autonomous';

/** Named bundles of per-axis postures. Order is irrelevant; `Full review` is
 * the default when no policy is set, so autonomy is always opt-in. */
export const PRESETS = ['Full review', 'Guard the contract', 'Hands-off'] as const;

export type PresetName = (typeof PRESETS)[number];

export type PostureMap = Record<Axis, Posture>;

/** Axes that `Guard the contract` keeps under human review. */
const CONTRACT_AXES: ReadonlySet<Axis> = new Set([
  'intent-and-scope',
  'behavioral-contract',
  'irreversible-design',
]);

function fullReview(): PostureMap {
  return Object.fromEntries(AXES.map(axis => [axis, 'ask'])) as PostureMap;
}

/** The per-axis posture map a preset expands to. */
export function presetPostureMap(preset: PresetName): PostureMap {
  switch (preset) {
    case 'Full review': {
      return fullReview();
    }
    case 'Hands-off': {
      return Object.fromEntries(AXES.map(axis => [axis, 'autonomous'])) as PostureMap;
    }
    case 'Guard the contract': {
      return Object.fromEntries(
        AXES.map(axis => [axis, CONTRACT_AXES.has(axis) ? 'ask' : 'autonomous']),
      ) as PostureMap;
    }
  }
}

export function isValidPreset(value: unknown): value is PresetName {
  return typeof value === 'string' && (PRESETS as readonly string[]).includes(value);
}

export function isValidPosture(value: unknown): value is Posture {
  return value === 'ask' || value === 'autonomous';
}

export function isValidAxis(value: unknown): value is Axis {
  return typeof value === 'string' && (AXES as readonly string[]).includes(value);
}

/** One layer of the policy: a preset plus optional per-axis overrides. */
interface PolicyLayer {
  preset?: unknown;
  overrides?: unknown;
}

export interface PolicyInput {
  project?: unknown;
  personal?: unknown;
}

function isLayer(value: unknown): value is PolicyLayer {
  return value !== null && typeof value === 'object';
}

/** Apply only the valid (axis, posture) pairs from an override object onto
 * `map`. Invalid axes and posture values are silently dropped — fail-safe,
 * never granting an unintended posture. */
function applyOverrides(map: PostureMap, overrides: unknown): void {
  if (overrides === null || typeof overrides !== 'object') return;
  for (const [axis, posture] of Object.entries(overrides as Record<string, unknown>)) {
    if (isValidAxis(axis) && isValidPosture(posture)) map[axis] = posture;
  }
}

/** Resolve the project layer to a base map. A malformed layer or unknown
 * preset falls back to Full review. */
function resolveProject(project: unknown): PostureMap {
  if (!isLayer(project)) return fullReview();
  const base = isValidPreset(project.preset) ? presetPostureMap(project.preset) : fullReview();
  applyOverrides(base, project.overrides);
  return base;
}

/**
 * Resolve the effective per-axis posture map.
 *
 * Precedence: personal override > project policy > preset defaults > Full
 * review. Any malformed layer is skipped rather than failing the whole
 * resolution, and the fallback is always toward more human review.
 */
export function resolvePolicy(input: PolicyInput): PostureMap {
  const map = resolveProject(input.project);
  if (isLayer(input.personal)) {
    if (isValidPreset(input.personal.preset)) {
      const personalBase = presetPostureMap(input.personal.preset);
      for (const axis of AXES) map[axis] = personalBase[axis];
    }
    applyOverrides(map, input.personal.overrides);
  }
  return map;
}

/** What the agent should do at a breakpoint on an axis with this posture. */
export function resolveBreakpointAction(posture: Posture): 'pause' | 'resolve' {
  return posture === 'ask' ? 'pause' : 'resolve';
}

/** Outcome of an autonomous resolution attempt via /figure-it-out. */
export interface FigureItOutResult {
  outcome: 'success' | 'transient-error' | 'inconclusive';
  /** 1 on the first attempt, 2 after the single permitted retry. */
  attempts: number;
}

/**
 * Fail-safe failure handling. A transient error/timeout earns exactly one
 * retry; a genuine inconclusive verdict defers immediately (re-running a real
 * tie will not break it). The agent never silently proceeds on a
 * non-success — it hands the decision back to the human.
 */
export function decideFailureAction(result: FigureItOutResult): 'proceed' | 'retry' | 'defer' {
  if (result.outcome === 'success') return 'proceed';
  if (result.outcome === 'inconclusive') return 'defer';
  return result.attempts >= 2 ? 'defer' : 'retry';
}
