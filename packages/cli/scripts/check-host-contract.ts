import { spawnSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import nodePath from 'node:path';

import { createResult, renderJsonResult } from '../src/cli-protocol/result.js';
import {
  behaviorAdoptions,
  behaviorDelegationKey,
  compositionEnvelopes,
  compositionFacets,
  type GuaranteeSupport,
  handlerEnvelopes,
  unclassifiedHandlerFindings,
} from '../src/host-contract/handlers.js';
import { discoverNativeHandlers } from '../src/host-contract/native-handler-discovery.js';
import { captureOwnerDelta, repoOwnershipGraph } from '../src/host-contract/owner-inventory.js';
import {
  callbackSourceCoverage,
  codexOuterCallCoverage,
  findCompetingHostContractOwners,
  hasClaudeEnvelopeProvenance,
  hasCodexEnvelopeProvenance,
  hasCodexQualityDelegation,
  hasCompositionDelegation,
  hasCursorEnvelopeProvenance,
  hasCursorHookDelegation,
  hasLibraryDelegation,
  hasOpenCodeV2QualityDelegation,
  policyOptionFindings,
} from '../src/host-contract/source-ownership.js';
import {
  PRODUCTION_INTEGRATIONS,
  supportsBehaviorGuarantee,
} from '../src/lifecycle/integrations.js';
import { discoverTemplateSources, runParity } from '../src/parity.js';
import { SAFEWORD_SCHEMA } from '../src/schema.js';
import { SHARED_BEHAVIOR_BINDINGS } from '../templates/hooks/lib/behavior-contract.js';

if (process.argv.includes('--owner-delta')) {
  const result = await captureOwnerDelta(process.cwd(), process.argv.slice(2));
  await new Promise<void>((resolve, reject) => {
    process.stdout.write(`${renderJsonResult(result)}\n`, error => {
      if (error) reject(error);
      else resolve();
    });
  });
  process.exit(result.exitCode);
}
try {
  const controllerRoot = nodePath.resolve(import.meta.dirname, '../../..');
  const sourceIndex = process.argv.indexOf('--source-root');
  const independent = sourceIndex !== -1;
  const root = independent ? realpathSync(process.argv[sourceIndex + 1] ?? '') : controllerRoot;
  const findings = findCompetingHostContractOwners(root);
  if (independent) {
    // Imported declarations describe the reviewed checkout. Only apply them to
    // matching candidate modules. Candidate modules are never loaded here.
    const loaded = Object.keys(require.cache);
    for (const declaration of [
      '../src/lifecycle/integrations.ts',
      '../src/schema.ts',
      '../templates/hooks/lib/behavior-contract.ts',
    ]) {
      if (!loaded.includes(require.resolve(declaration)))
        throw new Error(`Reviewed declaration is absent from the module inventory: ${declaration}`);
    }
    for (const file of loaded) {
      const relative = nodePath.relative(controllerRoot, file);
      if (
        !relative.startsWith('packages/cli/src/') &&
        !relative.startsWith('packages/cli/templates/')
      )
        continue;
      if (!readFileSync(nodePath.join(root, relative)).equals(readFileSync(file)))
        findings.push({
          code: 'HOST_CONTRACT_REVIEWED_MODULE_MISMATCH',
          severity: 'error',
          message: relative,
        });
    }
  }
  const handlers = PRODUCTION_INTEGRATIONS.flatMap(adapter => [
    ...(adapter.configuredHandlers?.() ?? []),
    ...(adapter.nativeHandlerSources ?? []).flatMap(source =>
      discoverNativeHandlers(root, adapter.id, source),
    ),
  ]);
  const sourceInventory = discoverTemplateSources(
    nodePath.join(root, 'packages/cli/templates'),
    SAFEWORD_SCHEMA,
  ).map(source => ({
    path: `packages/cli/templates/${source.template}`,
    destinations: source.destinations,
  }));
  findings.push(
    ...policyOptionFindings(
      root,
      sourceInventory.map(row => row.path),
    ),
  );
  const routes = PRODUCTION_INTEGRATIONS.flatMap(adapter =>
    (adapter.behaviorRoutes ?? []).map(route => ({ ...route, host: adapter.id })),
  );
  const ownerSources = sourceInventory.filter(source =>
    source.destinations.includes(
      `.safeword/${source.path.slice('packages/cli/templates/'.length)}`,
    ),
  );
  const owners = new Set(
    ownerSources.map(source => source.path.slice('packages/cli/templates/'.length)),
  );
  const delegations = new Set<string>();
  for (const route of routes) {
    const binding = SHARED_BEHAVIOR_BINDINGS.find(row => row.id === route.behavior);
    if (
      route.delegate &&
      owners.has(route.delegate) &&
      binding &&
      (binding.entrypoint === undefined
        ? (route.host === 'cursor' &&
            hasCursorHookDelegation(root, route.delegate, binding.owner)) ||
          (route.host === 'codex' &&
            hasCodexQualityDelegation(root, route.delegate, binding.owner)) ||
          (route.host === 'opencode' &&
            route.sourceFamily === 'opencode-v2' &&
            hasOpenCodeV2QualityDelegation(root, route.delegate, binding.owner))
        : hasLibraryDelegation(root, route.delegate, binding.owner, binding.entrypoint))
    )
      delegations.add(behaviorDelegationKey(route, binding.owner));
  }
  const supports: GuaranteeSupport = (host, trigger, guarantee) =>
    supportsBehaviorGuarantee(
      PRODUCTION_INTEGRATIONS.find(adapter => adapter.id === host)?.capabilities,
      trigger,
      guarantee,
    );
  const adoption = behaviorAdoptions(handlers, SHARED_BEHAVIOR_BINDINGS, routes, {
    sources: owners,
    delegations,
    supports,
  });
  const adopted = new Set(adoption.adoptions.map(row => row.registration_index));
  const composed = compositionFacets(
    handlers,
    SHARED_BEHAVIOR_BINDINGS,
    PRODUCTION_INTEGRATIONS.flatMap(adapter =>
      (adapter.handlerCompositions ?? []).map(composition => ({
        ...composition,
        host: adapter.id,
      })),
    ),
    (composition, binding) =>
      owners.has(binding.owner) && hasCompositionDelegation(root, composition, binding),
    {
      supports,
      adopted,
    },
  );
  const codex = PRODUCTION_INTEGRATIONS.find(adapter => adapter.id === 'codex');
  const resources = callbackSourceCoverage(
    root,
    handlers,
    PRODUCTION_INTEGRATIONS.flatMap(adapter =>
      [...(adapter.callbackResources ?? []), ...(adapter.callbackBoundaries ?? [])].map(route => ({
        ...route,
        host: adapter.id,
      })),
    ),
    new Set([...adopted, ...composed.facets.map(row => row.registration_index)]),
  );
  const accounted = new Set([
    ...adopted,
    ...resources.resources.map(row => row.registration_index),
    ...resources.boundaries.map(row => row.registration_index),
  ]);
  const outer = codexOuterCallCoverage(
    root,
    codex?.outerCallDispositions ?? [],
    codex?.handlerCompositions ?? [],
    composed.facets,
  );
  const envelopes = handlerEnvelopes(
    handlers,
    PRODUCTION_INTEGRATIONS.flatMap(adapter =>
      (adapter.handlerEnvelopes ?? []).map(envelope => ({ ...envelope, host: adapter.id })),
    ),
    routes,
    {
      adopted,
      occupied: new Set([...accounted, ...composed.facets.map(row => row.registration_index)]),
      provenance: envelope => hasClaudeEnvelopeProvenance(root, envelope),
    },
  );
  for (const envelope of envelopes.envelopes) accounted.add(envelope.registration_index);
  const joined = compositionEnvelopes(
    handlers,
    PRODUCTION_INTEGRATIONS.flatMap(adapter =>
      (adapter.handlerCompositions ?? []).map(composition => ({
        ...composition,
        host: adapter.id,
      })),
    ),
    {
      facets: composed.facets,
      occupied: accounted,
      provenance: composition => {
        if (composed.findings.some(finding => finding.metadata?.composition_id === composition.id))
          return false;
        if (composition.host === 'cursor') return hasCursorEnvelopeProvenance(root, composition);
        return (
          composition.host === 'codex' &&
          outer.findings.length === 0 &&
          outer.coverage
            .find(row => row.composition_id === composition.id)
            ?.calls.filter(
              call => call.kind === 'host_policy' && call.owner === composition.envelope?.owner,
            )
            .every(call => composition.envelope?.localPolicyScopes.includes(call.callee)) ===
            true &&
          hasCodexEnvelopeProvenance(root, composition)
        );
      },
    },
  );
  for (const envelope of joined.envelopes) accounted.add(envelope.registration_index);
  findings.push(
    ...joined.findings,
    ...envelopes.findings,
    ...outer.findings,
    ...composed.findings,
    ...adoption.findings,
    ...resources.findings,
    ...unclassifiedHandlerFindings(handlers, SHARED_BEHAVIOR_BINDINGS, accounted),
    ...sourceInventory
      .filter(source => source.destinations.length === 0)
      .map(source => ({
        code: 'UNACCOUNTED_HOST_CONTRACT_SOURCE',
        severity: 'error' as const,
        message: `Canonical source has no schema registration: ${source.path}`,
        metadata: { path: source.path },
      })),
  );
  const ownership = repoOwnershipGraph(root, sourceInventory, handlers, {
    adoptions: adoption.adoptions,
    facets: composed.facets,
    resources: [...resources.resources, ...resources.boundaries],
    envelopes: [...envelopes.envelopes, ...joined.envelopes],
    requirements: [
      ...routes.map(row => ({
        host: row.host,
        source_family: row.sourceFamily,
        behavior_id: row.behavior,
      })),
      ...PRODUCTION_INTEGRATIONS.flatMap(adapter =>
        (adapter.handlerCompositions ?? []).flatMap(composition =>
          composition.facets.map(facet => ({
            host: adapter.id,
            source_family: composition.sourceFamily,
            behavior_id: facet.behavior,
          })),
        ),
      ),
    ],
  });
  findings.push(...ownership.findings);
  const parity = runParity({
    schema: SAFEWORD_SCHEMA,
    mode: 'all',
    rootDirectory: root,
    templatesDirectory: nodePath.join(root, 'packages/cli/templates'),
  });
  findings.push(
    ...parity.failures.map(failure => ({
      code: 'HOST_CONTRACT_PROJECTION_DRIFT',
      severity: 'error' as const,
      message: failure.message,
    })),
  );
  // Failed source/ownership checks already prevent completion. Derivation is
  // mandatory on every otherwise-successful path, not a redundant failure probe.
  if (!independent && findings.length === 0) {
    const generated = spawnSync(
      process.execPath,
      ['packages/cli/scripts/check-generated-surfaces.ts'],
      { cwd: root, encoding: 'utf8', timeout: 90_000, maxBuffer: 8 * 1024 * 1024 },
    );
    if (generated.error || generated.signal || generated.status === null)
      throw new Error(
        `Generated projection check unavailable: ${generated.error?.message ?? generated.signal}`,
      );
    if (generated.status !== 0)
      findings.push({
        code: 'HOST_CONTRACT_GENERATED_OUTPUT_STALE',
        severity: 'error',
        message: `${generated.stdout}${generated.stderr}`,
      });
  }
  const complete = findings.length === 0;
  const result = createResult({
    state: complete ? 'healthy' : 'failed',
    exitCode: complete ? 0 : 2,
    findings,
    data: {
      command: 'host-contract check',
      scope: independent
        ? 'independent-source-and-registration-graph'
        : 'source-derivation-and-registration-graph',
      source_inventory: sourceInventory,
      handler_inventory: handlers,
      behavior_bindings: SHARED_BEHAVIOR_BINDINGS,
      behavior_adoptions: adoption.adoptions,
      handler_facets: composed.facets,
      handler_envelopes: [...envelopes.envelopes, ...joined.envelopes],
      callback_resources: resources.resources,
      callback_boundaries: resources.boundaries,
      outer_call_coverage: outer.coverage,
      missing_handler_inventory: PRODUCTION_INTEGRATIONS.filter(
        adapter => !adapter.configuredHandlers && !adapter.nativeHandlerSources?.length,
      ).map(adapter => adapter.id),
      ownership_graph: ownership.graph,
      inventory_complete: complete,
      admission_eligible: false,
    },
  });
  process.stdout.write(`${renderJsonResult(result)}\n`);
  process.exitCode = result.exitCode;
} catch (error) {
  const result = createResult({
    state: 'failed',
    exitCode: 3,
    errors: [
      {
        code: 'HOST_CONTRACT_PROOF_UNAVAILABLE',
        message: error instanceof Error ? error.message : String(error),
        retryable: false,
      },
    ],
  });
  process.stdout.write(`${renderJsonResult(result)}\n`);
  process.exitCode = 3;
}
