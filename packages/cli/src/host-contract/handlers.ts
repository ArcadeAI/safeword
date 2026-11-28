import type { SharedBehaviorBinding } from '../../templates/hooks/lib/behavior-contract.js';
import type { Finding } from '../cli-protocol/result.js';
import type { HostHandlerRegistration } from '../lifecycle/integrations.js';

interface NativeHook {
  readonly command?: string;
  readonly matcher?: string;
  readonly if?: string;
  readonly hooks?: readonly NativeHook[];
  readonly async?: boolean;
  readonly asyncRewake?: boolean;
}

/** Walk the actual configuration, including events outside the common lifecycle projection. */
export function configuredCommandHandlers(
  host: string,
  config: Readonly<Record<string, readonly NativeHook[]>>,
): HostHandlerRegistration[] {
  return Object.entries(config).flatMap(([event, groups]) =>
    groups.flatMap(group =>
      (group.hooks ?? [group]).map(hook => {
        if (hook.command === undefined) throw new Error(`Missing ${host} ${event} hook command`);
        const mode = hook.async ? 'background' : 'synchronous';
        const execution = hook.asyncRewake ? 'async-rewake' : mode;
        return {
          host,
          event,
          command: hook.command,
          matcher: group.matcher,
          condition: hook.if,
          handler_path:
            /\.safeword\/(?<path>hooks\/[\w./-]+)/u.exec(hook.command)?.groups?.path ?? '<inline>',
          interpreter: hook.command.split(/\s+/u, 1)[0] ?? '',
          execution,
          configuration: { group, hook },
        };
      }),
    ),
  );
}

export interface BehaviorRoute {
  readonly behavior: string;
  readonly event: string;
  readonly trigger: SharedBehaviorBinding['trigger'];
  readonly guarantees: SharedBehaviorBinding['guarantees'];
  readonly sourceFamily?: string;
  /** Exact native selection, when a command is registered under multiple tool matchers. */
  readonly matcher?: string;
  readonly condition?: string;
  readonly execution?: HostHandlerRegistration['execution'];
  readonly delegate?: string;
  readonly callbackSource?: string;
  readonly command?: (owner: string) => string | undefined;
}

/** Resource provenance is separate from lifecycle guarantees and whole-handler adoption. */
export interface CallbackSelection {
  readonly id: string;
  readonly sourceFamily: string;
  readonly callbackSource: string;
  readonly event: string;
  readonly scope: string;
  readonly ordinal: number;
  readonly callbackTarget?: string;
  readonly callbackCallees: readonly string[];
}
export interface CallbackResourceRoute extends CallbackSelection {
  readonly owner: string;
  readonly producer: string;
  readonly entrypoint: string;
  readonly readerArgument: string;
  readonly requiredCallees: readonly string[];
}

export interface CallbackBoundaryRoute extends CallbackSelection {
  readonly disposition: 'enrollment' | 'host_policy';
  readonly owner: string;
  readonly entrypoint: string;
  readonly producer?: string;
  readonly readerArgument?: string;
  readonly projectionEntrypoint?: string;
  readonly requiredCalls: readonly (readonly string[])[];
  readonly conditions: readonly string[];
  readonly reason: string;
}
export type CallbackSourceRoute = CallbackResourceRoute | CallbackBoundaryRoute;

type HandlerSelection = Omit<BehaviorRoute, 'behavior' | 'trigger' | 'guarantees'>;
/** An outer command joins independently adopted children; it grants no guarantee. */
export interface HandlerEnvelope extends HandlerSelection {
  readonly id: string;
  readonly owner: string;
  readonly childFamily?: string;
  readonly localPolicyScopes: readonly string[];
  readonly reason: string;
}

function envelopeFinding(
  selection: boolean,
  children: boolean,
  provenance: () => boolean,
): string | undefined {
  if (!selection) return 'HOST_CONTRACT_ENVELOPE_SELECTION_INVALID';
  if (!children) return 'HOST_CONTRACT_ENVELOPE_CHILD_UNACCOUNTED';
  if (!provenance()) return 'HOST_CONTRACT_ENVELOPE_PROVENANCE_MISSING';
  return undefined;
}

export function handlerEnvelopes(
  handlers: readonly HostHandlerRegistration[],
  envelopes: readonly (HandlerEnvelope & { host: string })[],
  routes: readonly (BehaviorRoute & { host: string })[],
  context: {
    adopted: ReadonlySet<number>;
    occupied: ReadonlySet<number>;
    provenance: (envelope: HandlerEnvelope) => boolean;
  },
) {
  const findings: Finding[] = [];
  const rows: {
    id: string;
    event: string;
    registration_index: number;
    child_indices: number[];
    owner: string;
    local_policy_scopes: readonly string[];
    reason: string;
  }[] = [];
  const used = new Set(context.occupied),
    ids = new Set<string>();
  for (const envelope of envelopes) {
    const matches = handlers.flatMap((handler, index) =>
      matchesRoute(handler, envelope, envelope.owner) ? [index] : [],
    );
    const index = matches[0];
    const children =
      envelope.childFamily === undefined
        ? []
        : handlers.flatMap((handler, i) =>
            handler.host === envelope.host &&
            handler.event === envelope.event &&
            handler.source_family === envelope.childFamily
              ? [i]
              : [],
          );
    const expected =
      envelope.childFamily === undefined
        ? 0
        : routes.filter(
            route =>
              route.host === envelope.host &&
              route.event === envelope.event &&
              route.sourceFamily === envelope.childFamily,
          ).length;
    const selectionValid =
      matches.length === 1 && index !== undefined && !used.has(index) && !ids.has(envelope.id);
    const code = envelopeFinding(
      selectionValid,
      children.length === expected && children.every(child => context.adopted.has(child)),
      () => context.provenance(envelope),
    );
    if (code !== undefined) {
      findings.push({
        code,
        severity: 'error',
        message: envelope.id,
        metadata: { id: envelope.id, host: envelope.host },
      });
      continue;
    }
    // Successful exact selection necessarily has an index.
    if (index === undefined) continue;
    used.add(index);
    ids.add(envelope.id);
    rows.push({
      id: envelope.id,
      event: envelope.event,
      registration_index: index,
      child_indices: children,
      owner: envelope.owner,
      local_policy_scopes: envelope.localPolicyScopes,
      reason: envelope.reason,
    });
  }
  return { envelopes: rows, findings };
}
export interface OuterCallDisposition {
  readonly callee: string;
  /** Omission means all selected Codex compositions, including their common parent. */
  readonly events?: readonly string[];
  readonly kind: 'transport' | 'host_policy' | 'shared_delegate' | 'evidence';
  readonly reason: string;
}
export interface HandlerComposition extends HandlerSelection {
  readonly id: string;
  readonly envelope?: Pick<HandlerEnvelope, 'owner' | 'localPolicyScopes' | 'reason'>;
  readonly trigger: SharedBehaviorBinding['trigger'];
  /** Exact host field when present; omission requires no configured loop_limit. */
  readonly loopLimit?: number;
  readonly facets: readonly {
    readonly behavior: string;
    readonly disposition: 'implementation' | 'permitted_alternative' | 'unmet';
    readonly guarantee?: SharedBehaviorBinding['guarantees'][number];
    readonly reason?: string;
    readonly recovery?: string;
  }[];
}

type FacetSelection = { composition_id: string; registration_index: number; behavior_id: string };
function exactFacetJoin(
  composition: HandlerComposition,
  index: number,
  facets: readonly FacetSelection[],
): boolean {
  const selected = facets.filter(row => row.registration_index === index);
  return (
    selected.length === composition.facets.length &&
    selected.length > 0 &&
    selected.every(row => row.composition_id === composition.id) &&
    composition.facets.every(
      facet => selected.filter(row => row.behavior_id === facet.behavior).length === 1,
    )
  );
}

/** Intentional same-index relation, not a whole adoption or an exclusivity exception. */
export function compositionEnvelopes(
  handlers: readonly HostHandlerRegistration[],
  compositions: readonly (HandlerComposition & { host: string })[],
  context: {
    facets: readonly FacetSelection[];
    occupied: ReadonlySet<number>;
    provenance: (composition: HandlerComposition & { host: string }) => boolean;
  },
) {
  const findings: Finding[] = [];
  const rows: {
    id: string;
    composition_id: string;
    event: string;
    registration_index: number;
    owner: string;
    local_policy_scopes: readonly string[];
    reason: string;
    facet_behaviors: string[];
  }[] = [];
  const used = new Set(context.occupied);
  const declared = compositions.filter(row => row.envelope !== undefined);
  for (const composition of declared) {
    const matches = handlers.flatMap((handler, index) =>
      matchesRoute(handler, composition, composition.delegate ?? '') ? [index] : [],
    );
    const index = matches[0];
    const selection = matches.length === 1 && index !== undefined && !used.has(index);
    const code = envelopeFinding(
      selection,
      index !== undefined && exactFacetJoin(composition, index, context.facets),
      () => context.provenance(composition),
    );
    if (code !== undefined) {
      findings.push({
        code,
        severity: 'error',
        message: composition.id,
        metadata: { id: composition.id, host: composition.host },
      });
      continue;
    }
    if (index === undefined || composition.envelope === undefined) continue;
    used.add(index);
    rows.push({
      id: `${composition.id}.envelope`,
      composition_id: composition.id,
      event: composition.event,
      registration_index: index,
      owner: composition.envelope.owner,
      local_policy_scopes: composition.envelope.localPolicyScopes,
      reason: composition.envelope.reason,
      facet_behaviors: composition.facets.map(facet => facet.behavior),
    });
  }
  return { envelopes: rows, findings };
}

/** Mechanical native event codec, independent of a route's claimed shared trigger. */
function hostEventTrigger(
  host: string,
  event: string,
): SharedBehaviorBinding['trigger'] | undefined {
  if (host === 'opencode') return event === 'tool.execute.before' ? 'pre_tool' : undefined;
  if (host === 'cursor') {
    const events: Readonly<Record<string, SharedBehaviorBinding['trigger']>> = {
      sessionStart: 'session_start',
      postToolUse: 'post_tool',
      afterFileEdit: 'post_tool',
      preToolUse: 'pre_tool',
      beforeShellExecution: 'pre_tool',
      stop: 'stop',
    };
    return events[event];
  }
  if (host !== 'claude' && host !== 'codex') return undefined;
  const events: Readonly<Record<string, SharedBehaviorBinding['trigger']>> = {
    SessionStart: 'session_start',
    UserPromptSubmit: 'prompt_submit',
    PreToolUse: 'pre_tool',
    PostToolUse: 'post_tool',
    Stop: 'stop',
    SessionEnd: 'session_end',
  };
  return host === 'codex' && event === 'SessionEnd' ? undefined : events[event];
}

function sameGuarantees(binding: SharedBehaviorBinding, route: BehaviorRoute): boolean {
  return (
    new Set(binding.guarantees).size === binding.guarantees.length &&
    new Set(route.guarantees).size === route.guarantees.length &&
    binding.guarantees.length === route.guarantees.length &&
    route.guarantees.every(guarantee => binding.guarantees.includes(guarantee))
  );
}
function bindingError(
  binding: SharedBehaviorBinding | undefined,
  ownerCount: number,
  route: BehaviorRoute & { host: string },
  sources: ReadonlySet<string>,
  supports: GuaranteeSupport,
): string | undefined {
  if (ownerCount !== 1 || binding === undefined) return 'HOST_CONTRACT_BINDING_OWNER_CONFLICT';
  if (!sources.has(binding.owner)) return 'HOST_CONTRACT_BINDING_OWNER_MISSING';
  if (
    binding.trigger !== route.trigger ||
    hostEventTrigger(route.host, route.event) !== route.trigger
  )
    return 'HOST_CONTRACT_BINDING_TRIGGER_MISMATCH';
  if (!sameGuarantees(binding, route)) return 'HOST_CONTRACT_BINDING_GUARANTEE_MISMATCH';
  return binding.guarantees.some(guarantee => !supports(route.host, binding.trigger, guarantee))
    ? 'HOST_CONTRACT_BINDING_CAPABILITY_UNSUPPORTED'
    : undefined;
}

export function behaviorDelegationKey(
  route: BehaviorRoute & { host: string },
  owner: string,
): string {
  return JSON.stringify([route.host, route.delegate, owner, route.sourceFamily]);
}

function validDelegation(
  route: BehaviorRoute & { host: string },
  owner: string,
  sources: ReadonlySet<string>,
  delegations: ReadonlySet<string>,
): boolean {
  if (route.delegate === undefined) return true;
  return sources.has(route.delegate) && delegations.has(behaviorDelegationKey(route, owner));
}
function matchesDelegateExecution(
  handler: HostHandlerRegistration,
  route: HandlerSelection,
): boolean {
  if (route.callbackSource !== undefined) return handler.execution === 'native-callback';
  if (route.execution !== undefined)
    return (
      handler.execution === route.execution &&
      handler.condition === route.condition &&
      handler.matcher === route.matcher
    );
  return (
    route.delegate === undefined ||
    (handler.execution === 'synchronous' &&
      handler.condition === route.condition &&
      handler.matcher === route.matcher)
  );
}
function matchesCommand(
  handler: HostHandlerRegistration,
  route: HandlerSelection,
  owner: string,
): boolean {
  if (route.callbackSource !== undefined)
    return (
      route.command === undefined &&
      handler.command === undefined &&
      handler.handler_path === route.callbackSource
    );
  const command = route.command?.(route.delegate ?? owner);
  return command !== undefined && handler.command === command;
}
function matchesRoute(
  handler: HostHandlerRegistration,
  route: HandlerSelection & { host: string },
  owner: string,
): boolean {
  return (
    handler.host === route.host &&
    handler.event === route.event &&
    handler.source_family === route.sourceFamily &&
    matchesCommand(handler, route, owner) &&
    matchesDelegateExecution(handler, route) &&
    (route.matcher === undefined ||
      (handler.matcher === route.matcher && handler.condition === route.condition))
  );
}

function delegationOrReuseError(
  route: BehaviorRoute & { host: string },
  owner: string,
  sources: ReadonlySet<string>,
  delegations: ReadonlySet<string>,
  reused: boolean,
): string | undefined {
  if (!validDelegation(route, owner, sources, delegations))
    return 'HOST_CONTRACT_BINDING_DELEGATION_MISSING';
  return reused ? 'HOST_CONTRACT_BINDING_ADOPTION_DUPLICATE' : undefined;
}

export type GuaranteeSupport = (
  host: string,
  trigger: SharedBehaviorBinding['trigger'],
  guarantee: SharedBehaviorBinding['guarantees'][number] | undefined,
) => boolean;

/** Source registration adoption only; never a native execution or admission receipt. */
export function behaviorAdoptions(
  handlers: readonly HostHandlerRegistration[],
  bindings: readonly SharedBehaviorBinding[],
  routes: readonly (BehaviorRoute & { host: string })[],
  {
    sources,
    delegations,
    supports,
  }: {
    sources: ReadonlySet<string>;
    delegations: ReadonlySet<string>;
    supports: GuaranteeSupport;
  },
) {
  const findings: Finding[] = [];
  const adoptions: {
    behavior_id: string;
    owner: string;
    registration_index: number;
    host: string;
    event: string;
    source_family?: string;
    trigger: string;
    guarantees: SharedBehaviorBinding['guarantees'];
  }[] = [];
  const routeIdentities = new Set<string>();
  const adoptedIndices = new Set<number>();
  for (const route of routes) {
    const fail = (code: string, count?: number) => {
      findings.push({
        code,
        severity: 'error',
        message: `${route.behavior}: ${route.host} ${route.sourceFamily ?? 'legacy'} ${route.event}`,
        metadata: {
          behavior_id: route.behavior,
          host: route.host,
          event: route.event,
          source_family: route.sourceFamily ?? 'legacy',
          ...(route.matcher !== undefined && {
            matcher: route.matcher,
            condition: route.condition,
          }),
          ...(count !== undefined && { matching_count: count }),
        },
      });
    };
    const identity = JSON.stringify([
      route.behavior,
      route.host,
      route.sourceFamily,
      route.event,
      route.matcher,
      route.condition,
    ]);
    if (routeIdentities.has(identity)) {
      fail('HOST_CONTRACT_BINDING_ADOPTION_DUPLICATE');
      continue;
    }
    routeIdentities.add(identity);
    const owners = bindings.filter(binding => binding.id === route.behavior);
    const binding = owners[0];
    const error = bindingError(binding, owners.length, route, sources, supports);
    if (error !== undefined || binding === undefined) {
      fail(error ?? 'HOST_CONTRACT_BINDING_OWNER_CONFLICT');
      continue;
    }
    const matches = handlers.flatMap((handler, index) =>
      matchesRoute(handler, route, binding.owner) ? [index] : [],
    );
    const index = matches[0];
    if (matches.length !== 1 || index === undefined) {
      fail(
        matches.length > 1
          ? 'HOST_CONTRACT_BINDING_ADOPTION_DUPLICATE'
          : 'HOST_CONTRACT_BINDING_ADOPTION_MISSING',
        matches.length,
      );
      continue;
    }
    const adoptionError = delegationOrReuseError(
      route,
      binding.owner,
      sources,
      delegations,
      adoptedIndices.has(index),
    );
    if (adoptionError !== undefined) {
      fail(adoptionError, 1);
      continue;
    }
    adoptedIndices.add(index);
    adoptions.push({
      behavior_id: binding.id,
      owner: binding.owner,
      registration_index: index,
      host: route.host,
      event: route.event,
      source_family: route.sourceFamily,
      trigger: binding.trigger,
      guarantees: binding.guarantees,
    });
  }
  return { findings, adoptions };
}

function unmetFacetHasRecovery(facet: HandlerComposition['facets'][number]): boolean {
  return (
    facet.guarantee === undefined &&
    [facet.reason, facet.recovery].every(
      value => typeof value === 'string' && value.trim().length > 0,
    )
  );
}
function validFacetDisposition(
  facet: HandlerComposition['facets'][number],
  binding: SharedBehaviorBinding,
  supported: boolean,
): boolean {
  if (facet.disposition === 'unmet') return unmetFacetHasRecovery(facet);
  if (facet.disposition !== 'implementation' && facet.disposition !== 'permitted_alternative')
    return false;
  const allowed =
    facet.disposition === 'implementation' ? binding.guarantees : binding.permittedAlternatives;
  return facet.guarantee !== undefined && allowed?.includes(facet.guarantee) === true && supported;
}

/** Partial known-entrypoint relation. It never grants whole-handler adoption or native proof. */
function compositionConflict(
  index: number,
  used: ReadonlySet<number>,
  adopted: ReadonlySet<number>,
): string | undefined {
  if (adopted.has(index)) return 'HOST_CONTRACT_COMPOSITION_ADOPTION_OVERLAP';
  if (used.has(index)) return 'HOST_CONTRACT_COMPOSITION_SELECTION_INVALID';
  return undefined;
}
export function compositionFacets(
  handlers: readonly HostHandlerRegistration[],
  bindings: readonly SharedBehaviorBinding[],
  compositions: readonly (HandlerComposition & { host: string })[],
  delegates: (
    composition: HandlerComposition & { host: string },
    binding: SharedBehaviorBinding,
  ) => boolean,
  {
    supports,
    adopted,
  }: {
    supports: GuaranteeSupport;
    adopted: ReadonlySet<number>;
  },
) {
  const findings: Finding[] = [];
  const used = new Set<number>();
  const facets = compositions.flatMap(composition => {
    const fail = (code: string, behavior?: string) => {
      findings.push({
        code,
        severity: 'error',
        message: `${composition.id}: ${behavior ?? composition.event}`,
        metadata: {
          composition_id: composition.id,
          behavior_id: behavior,
          host: composition.host,
          source_family: composition.sourceFamily ?? 'legacy',
        },
      });
    };
    const matches = handlers.flatMap((row, index) =>
      matchesRoute(row, composition, composition.delegate ?? '') ? [index] : [],
    );
    const index = matches[0];
    if (matches.length !== 1 || index === undefined) {
      fail('HOST_CONTRACT_COMPOSITION_SELECTION_INVALID');
      return [];
    }
    const conflict = compositionConflict(index, used, adopted);
    if (conflict !== undefined) {
      fail(conflict);
      return [];
    }
    used.add(index);
    const config = handlers[index]?.configuration as { hook?: { loop_limit?: unknown } };
    if (
      config.hook?.loop_limit !== composition.loopLimit ||
      hostEventTrigger(composition.host, composition.event) !== composition.trigger
    ) {
      fail('HOST_CONTRACT_COMPOSITION_OPTIONS_INVALID');
      return [];
    }
    const known = bindings.filter(binding => delegates(composition, binding));
    for (const binding of known) {
      if (composition.facets.every(facet => facet.behavior !== binding.id))
        fail('HOST_CONTRACT_FACET_DISPOSITION_MISSING', binding.id);
    }
    const seen = new Set<string>();
    return composition.facets.flatMap(facet => {
      if (seen.has(facet.behavior)) {
        fail('HOST_CONTRACT_FACET_DUPLICATE', facet.behavior);
        return [];
      }
      seen.add(facet.behavior);
      const owners = known.filter(binding => binding.id === facet.behavior);
      const binding = owners[0];
      if (owners.length !== 1 || binding?.trigger !== composition.trigger) {
        fail('HOST_CONTRACT_FACET_SOURCE_MISSING', facet.behavior);
        return [];
      }
      if (
        !validFacetDisposition(
          facet,
          binding,
          supports(composition.host, composition.trigger, facet.guarantee),
        )
      ) {
        fail('HOST_CONTRACT_FACET_DISPOSITION_INVALID', facet.behavior);
        return [];
      }
      return [
        {
          composition_id: composition.id,
          behavior_id: binding.id,
          owner: binding.owner,
          registration_index: index,
          disposition: facet.disposition,
          declared_guarantee: facet.guarantee,
          reason: facet.reason,
          recovery: facet.recovery,
          loop_limit: composition.loopLimit,
          provenance: 'import-call-export',
          complete: false,
        },
      ];
    });
  });
  return { facets, findings };
}

export function unclassifiedHandlerFindings(
  handlers: readonly HostHandlerRegistration[],
  bindings: readonly SharedBehaviorBinding[],
  adopted: ReadonlySet<number> = new Set(),
): Finding[] {
  const owners = new Set(
    bindings.filter(binding => !binding.requireExplicitRoutes).map(binding => binding.owner),
  );
  return handlers
    .filter((handler, index) => !owners.has(handler.handler_path) && !adopted.has(index))
    .map(handler => ({
      code: 'UNCLASSIFIED_HOST_CONTRACT_HANDLER',
      severity: 'error',
      message: `${handler.host} ${handler.event} handler has no shared classification: ${handler.handler_path}`,
      metadata: {
        host: handler.host,
        event: handler.event,
        handler_path: handler.handler_path,
        source_family: handler.source_family,
      },
    }));
}
