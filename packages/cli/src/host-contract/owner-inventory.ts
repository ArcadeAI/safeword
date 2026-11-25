import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import nodePath from 'node:path';

import { AstBuilder, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin';
import { IdGenerator } from '@cucumber/messages';

import { SHARED_BEHAVIOR_BINDINGS } from '../../templates/hooks/lib/behavior-contract.js';
import type { Finding } from '../cli-protocol/result.js';
import { createResult } from '../cli-protocol/result.js';
import { readCursorRuleWrappers } from '../cursor-wrappers.js';
import type { HostHandlerRegistration } from '../lifecycle/integrations.js';
import { CONFORMANCE_RUN_LAYOUT } from '../schema.js';
import { readPackagedSkillContracts } from './catalogue.js';
import { publishConformanceAttempt } from './conformance-run.js';
import type { behaviorAdoptions, compositionFacets } from './handlers.js';
import {
  findCompetingHostContractOwners,
  HOST_CONTRACT_OWNER_SOURCES,
} from './source-ownership.js';

/** Exact native runtime declarations from the existing catalogue scenario, not another host list. */
function declaredNativeTargets(source: string): string[] {
  const document = new Parser(
    new AstBuilder(IdGenerator.incrementing()),
    new GherkinClassicTokenMatcher(),
  ).parse(source);
  const catalogue = document.feature?.children
    .flatMap(child => child.rule?.children ?? [child])
    .find(
      child => child.scenario?.name === 'Native delivery exposes the contracted catalogue',
    )?.scenario;
  return (
    catalogue?.examples.flatMap(example => {
      const headers = example.tableHeader?.cells.map(cell => cell.value) ?? [];
      return example.tableBody.map(row => {
        const values = Object.fromEntries(
          headers.map((key, index) => [key, row.cells[index]?.value]),
        );
        const host = values.host;
        let agent = host?.toLowerCase();
        if (host === 'Claude Code') agent = 'claude';
        else if (host === 'OpenCode V2') agent = 'opencode';
        return `${agent}:${values.version}:${values.runtime}`;
      });
    }) ?? []
  );
}

// Independently reviewed baseline rule/phase references, not live detector output.
const cursorPurposeSources = [
  'bdd/SKILL.md',
  'bdd/DISCOVERY.md',
  'bdd/DONE.md',
  'bdd/PLAN_EXECUTION.md',
  'bdd/PLAN_IMPLEMENTATION.md',
  'bdd/SCENARIOS.md',
  'bdd/SPLITTING.md',
  'bdd/TDD.md',
  'bdd/VERIFY.md',
  'brainstorm/SKILL.md',
  'debug/SKILL.md',
  'demand-research/SKILL.md',
  'elicit/SKILL.md',
  'figure-it-out/SKILL.md',
  'finish-review/SKILL.md',
  'pr-readiness/SKILL.md',
  'quality-review/SKILL.md',
  'refactor/SKILL.md',
  'retro-filer/SKILL.md',
  'tdd-review/SKILL.md',
  'testing/SKILL.md',
  'ticket-system/SKILL.md',
];
const purposeOwners = cursorPurposeSources.map(reference => {
  const [skill, file] = reference.split('/', 2);
  const suffix = file === 'SKILL.md' ? '' : `.${file?.slice(0, -3)}`;
  return {
    owner_id: `cursor.rule.${skill}${suffix}.purpose`,
    canonical_purpose_source: `packages/cli/templates/skills/${reference}`,
  };
});
/** Complete independently intended known-shape baseline set; not a full facet/handler graph oracle. */
const oracle = {
  scope: 'pr3-current-committed-source-owner-graph',
  retired: [
    'codex.intake.required-fields',
    'opencode.catalogue.codex-renderer-authority',
    'opencode.catalogue.cursor-command-authority',
    ...purposeOwners.map(owner => owner.owner_id),
    'codex.prompt.timestamp',
  ],
  intended_purpose_owners: purposeOwners,
  retained: ['packages/cli/templates/hooks/codex/pre-tool-quality.ts'],
};
const hashBytes = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const digest = (value: unknown) => hashBytes(JSON.stringify(value));

/** Exact selector identity, including SDK scope and delivery family. */
export function registrationIdentity(row: HostHandlerRegistration): string {
  const config = row.configuration as { callback_scope?: string; callback_ordinal?: number };
  return JSON.stringify([
    row.host,
    row.source_family ?? 'project',
    row.event,
    row.command ?? '',
    row.matcher,
    row.condition,
    row.execution,
    config.callback_scope,
    config.callback_ordinal,
  ]);
}

interface GraphLane {
  id: string;
  host: string;
  delivery: string;
}
interface LaneDisposition {
  id: string;
  applicable: boolean;
  disposition?: 'implementation' | 'permitted_alternative' | 'unmet';
  reason: string;
  recovery?: string;
}
interface OwnedNode {
  id: string;
  owner: string;
  lanes: LaneDisposition[];
}
interface GraphRelation {
  registration_index: number;
  owner: string;
  reason?: string;
}
interface GraphRelations {
  adoptions: ReturnType<typeof behaviorAdoptions>['adoptions'];
  facets: ReturnType<typeof compositionFacets>['facets'];
  resources: readonly GraphRelation[];
  envelopes: readonly GraphRelation[];
  requirements: readonly { host: string; source_family?: string; behavior_id: string }[];
}
const templatesPrefix = 'packages/cli/templates/';
function sourceOwner(owner: string): string {
  if (!owner) return '';
  return owner.startsWith('packages/') ? owner : `${templatesPrefix}${owner}`;
}
function applies(
  lane: GraphLane,
  handler: Pick<HostHandlerRegistration, 'host' | 'source_family'>,
): boolean {
  return (
    lane.host === handler.host &&
    (lane.host !== 'cursor' ||
      lane.delivery === (handler.source_family === 'cursor-native' ? 'native' : 'project-hooks'))
  );
}

/** Read-only source/derivation join. Source availability is NOT a lifecycle guarantee. */
export function repoOwnershipGraph(
  root: string,
  sources: readonly { path: string; destinations: readonly string[] }[],
  handlers: readonly HostHandlerRegistration[],
  relations: GraphRelations,
) {
  const findings: Finding[] = [];
  const fail = (code: string, id: string) => {
    findings.push({ code, severity: 'error', message: id, metadata: { id } });
  };
  // Integration metadata owns lanes; this snapshot is an independent expected set.
  const expected = JSON.parse(
    readFileSync(
      nodePath.join(root, 'packages/cli/tests/fixtures/host-contract/targets.json'),
      'utf8',
    ),
  ) as {
    targets: { agent: string; version: string; runtimes: string[]; delivery_variants?: string[] }[];
  };
  const declarations: Record<string, (typeof expected.targets)[number]> = JSON.parse(
    readFileSync(nodePath.join(root, 'packages/cli/src/lifecycle/host-releases.json'), 'utf8'),
  );
  const targets = Object.values(declarations);
  const targetLanes = (rows: typeof expected.targets): GraphLane[] =>
    rows.flatMap(target =>
      target.runtimes.flatMap(runtime =>
        (target.delivery_variants ?? ['native']).map(delivery => ({
          id: `${target.agent}:${target.version}:${runtime}:${delivery}`,
          host: target.agent,
          delivery,
        })),
      ),
    );
  const lanes = targetLanes(targets);
  const oracleLanes = targetLanes(expected.targets);
  validateTargetLanes(root, lanes, fail);
  validateTargetLanes(root, oracleLanes, fail);
  validateTargetOracle(lanes, oracleLanes, handlers, fail);
  for (const handler of handlers)
    if (lanes.every(lane => !applies(lane, handler)))
      fail('HOST_CONTRACT_GRAPH_LANE_MISSING', registrationIdentity(handler));
  for (const lane of lanes)
    if (handlers.every(handler => !applies(lane, handler)))
      fail('HOST_CONTRACT_GRAPH_LANE_UNKNOWN', lane.id);
  if (new Set(lanes.map(lane => lane.id)).size !== lanes.length)
    fail('HOST_CONTRACT_GRAPH_LANE_DUPLICATE', 'targets');
  const templates = nodePath.join(root, templatesPrefix);
  const skillOwners = new Map(
    readPackagedSkillContracts(nodePath.join(templates, 'skills')).map(skill => [
      skill.name,
      `${templatesPrefix}skills/${skill.relativePath}`,
    ]),
  );
  const derivedOwners = new Map<string, string>([
    ...sources
      .filter(source => source.path.startsWith(`${templatesPrefix}commands/`))
      .flatMap(source => {
        const owner = skillOwners.get(nodePath.basename(source.path, '.md'));
        if (owner !== undefined) return [[source.path, owner] as const];
        fail('HOST_CONTRACT_GRAPH_OWNER_MISSING', source.path);
        return [];
      }),
    ...readCursorRuleWrappers(templates).map(
      row =>
        [
          `${templatesPrefix}cursor/rules/${row.name}.mdc`,
          `${templatesPrefix}${row.referencePath.replace(/^\.safeword\//u, '')}`,
        ] as const,
    ),
  ]);
  const facets = sources.map(source => ({
    path: source.path,
    owner:
      derivedOwners.get(source.path) ??
      (source.path.startsWith(`${templatesPrefix}commands/`) ? '' : source.path),
    lanes: lanes.map(lane => contentLane(source.path, lane, relations)),
  }));
  const nodes: OwnedNode[] = [];
  for (const binding of SHARED_BEHAVIOR_BINDINGS) {
    const owner = sourceOwner(binding.owner);
    const dispositions = lanes.map(lane => behaviorLane(binding.id, lane, handlers, relations));
    nodes.push({ id: `behavior:${binding.id}`, owner, lanes: dispositions });
  }
  const localSources = [...relations.resources, ...relations.envelopes];
  const localOwners = new Set(localSources.map(row => sourceOwner(row.owner)).filter(Boolean));
  for (const owner of localOwners) {
    if (facets.some(facet => facet.path === owner)) continue;
    const claims = localSources.filter(row => sourceOwner(row.owner) === owner);
    nodes.push({
      id: owner,
      owner,
      lanes: lanes.map(lane =>
        scopeLane(
          lane,
          claims.some(row => {
            const handler = handlers[row.registration_index];
            return handler !== undefined && applies(lane, handler);
          }),
          `Validated source-owner projection: ${owner}; behavior guarantees remain separate.`,
        ),
      ),
    });
  }
  const registrations = handlers.map((handler, index) => {
    const identity = registrationIdentity(handler);
    const adopted = relations.adoptions.filter(row => row.registration_index === index);
    const envelopes = relations.envelopes.filter(row => row.registration_index === index);
    const resources = relations.resources.filter(row => row.registration_index === index);
    const selected = [...adopted, ...envelopes, ...resources];
    if (selected.length !== 1) fail('HOST_CONTRACT_GRAPH_REGISTRATION_OWNER_CONFLICT', identity);
    const owner = sourceOwner(selected[0]?.owner ?? '');
    const behaviors = [
      ...adopted,
      ...relations.facets.filter(row => row.registration_index === index),
    ];
    const links = behaviors.map(row => `behavior:${row.behavior_id}`);
    if (owner) links.push(owner);
    return { identity, owner, facets: [...new Set(links)] };
  });
  validateGraph(
    root,
    [...facets.map(facet => ({ ...facet, id: facet.path })), ...nodes],
    registrations,
    fail,
  );
  validateGraphRelations(
    { handlers, lanes, nodes: [...facets.map(facet => ({ ...facet, id: facet.path })), ...nodes] },
    registrations,
    relations,
    fail,
  );
  return { graph: { lanes, facets, handler_facets: nodes, registrations }, findings };
}

function validateTargetOracle(
  lanes: GraphLane[],
  expected: GraphLane[],
  handlers: readonly HostHandlerRegistration[],
  fail: (code: string, id: string) => void,
): void {
  for (const lane of expected) {
    if (lanes.every(row => row.id !== lane.id)) fail('HOST_CONTRACT_TARGET_UNDECLARED', lane.id);
    if (handlers.every(handler => !applies(lane, handler)))
      fail('HOST_CONTRACT_GRAPH_LANE_UNKNOWN', lane.id);
  }
  for (const lane of lanes)
    if (expected.every(row => row.id !== lane.id)) fail('HOST_CONTRACT_TARGET_MISSING', lane.id);
  if (new Set(expected.map(lane => lane.id)).size !== expected.length)
    fail('HOST_CONTRACT_GRAPH_LANE_DUPLICATE', 'expected-targets');
}

function validateTargetLanes(
  root: string,
  lanes: GraphLane[],
  fail: (code: string, id: string) => void,
): void {
  const source = readFileSync(
    nodePath.join(root, 'features/consistent-host-contract.feature'),
    'utf8',
  );
  const required = new Set(declaredNativeTargets(source));
  for (const lane of lanes)
    if (!required.has(lane.id.slice(0, -lane.delivery.length - 1)))
      fail('HOST_CONTRACT_TARGET_UNDECLARED', lane.id);
  for (const target of required)
    if (lanes.every(lane => lane.id !== `${target}:native`))
      fail('HOST_CONTRACT_TARGET_MISSING', `${target}:native`);
}

function behaviorLane(
  id: string,
  lane: GraphLane,
  handlers: readonly HostHandlerRegistration[],
  relations: GraphRelations,
): LaneDisposition {
  if (relations.requirements.every(row => !(row.behavior_id === id && applies(lane, row))))
    return scopeLane(lane, false, `No declared ${id} scope for ${lane.id}.`);
  const rows = [
    ...relations.adoptions
      .filter(row => row.behavior_id === id)
      .map(row => ({
        ...row,
        disposition: 'implementation' as const,
        reason: undefined,
        recovery: undefined,
      })),
    ...relations.facets.filter(row => row.behavior_id === id),
  ].filter(row => {
    const handler = handlers[row.registration_index];
    return handler !== undefined && applies(lane, handler);
  });
  const selected =
    rows.find(row => row.disposition === 'unmet') ??
    rows.find(row => row.disposition === 'permitted_alternative');
  if (selected)
    return {
      id: lane.id,
      applicable: true,
      disposition: selected.disposition,
      reason: selected.reason ?? `Validated ${id} projection.`,
      recovery: selected.recovery,
    };
  if (rows.length === 0)
    return {
      id: lane.id,
      applicable: true,
      disposition: 'unmet',
      reason: `No validated ${id} registration on ${lane.id}.`,
      recovery: `Implement and prove the ${id} adapter on ${lane.id} before claiming this guarantee.`,
    };
  return {
    id: lane.id,
    applicable: true,
    disposition: 'implementation',
    reason: `Validated registration/source relation for ${id}; native delivery remains separate.`,
  };
}
function scopeLane(lane: GraphLane, applicable: boolean, reason: string): LaneDisposition {
  return {
    id: lane.id,
    applicable,
    reason,
    ...(applicable && { disposition: 'implementation' as const }),
  };
}
function contentLane(path: string, lane: GraphLane, relations: GraphRelations): LaneDisposition {
  const parts = path.slice(templatesPrefix.length).split('/');
  const namespace = parts[0] === 'hooks' ? parts[1] : parts[0];
  if (relations.requirements.some(row => row.host === namespace))
    return scopeLane(
      lane,
      lane.host === namespace,
      `Host-local ${namespace} source namespace: ${path}.`,
    );
  const bindings = SHARED_BEHAVIOR_BINDINGS.filter(binding => sourceOwner(binding.owner) === path);
  const declared = relations.requirements.filter(row =>
    bindings.some(binding => binding.id === row.behavior_id),
  );
  if (declared.length > 0)
    return scopeLane(
      lane,
      declared.some(row => row.host === lane.host),
      `Canonical owner for declared host routes: ${path}; not host execution proof.`,
    );
  return scopeLane(
    lane,
    true,
    `Shared schema/catalogue resource: ${path}; availability only, not host execution.`,
  );
}

function validateGraphRelations(
  context: {
    handlers: readonly HostHandlerRegistration[];
    lanes: readonly GraphLane[];
    nodes: readonly OwnedNode[];
  },
  registrations: readonly { identity: string; owner: string; facets: string[] }[],
  relations: GraphRelations,
  fail: (code: string, id: string) => void,
): void {
  const { handlers, lanes, nodes } = context;
  const behaviorRows = [...relations.adoptions, ...relations.facets];
  const ownershipRows = [...relations.adoptions, ...relations.resources, ...relations.envelopes];
  for (const [index, registration] of registrations.entries()) {
    const owner = sourceOwner(
      ownershipRows.find(row => row.registration_index === index)?.owner ?? '',
    );
    if (owner !== registration.owner)
      fail('HOST_CONTRACT_GRAPH_OWNER_MISMATCH', registration.identity);
    const expected = new Set(
      behaviorRows
        .filter(row => row.registration_index === index)
        .map(row => `behavior:${row.behavior_id}`),
    );
    if (owner) expected.add(owner);
    validateExactLinks(registration, expected, fail);
    const handler = handlers[index];
    if (handler)
      validateLinkedLanes(
        handler,
        lanes,
        nodes.filter(node => registration.facets.includes(node.id)),
        fail,
      );
  }
}
function validateExactLinks(
  registration: { identity: string; facets: string[] },
  expected: ReadonlySet<string>,
  fail: (code: string, id: string) => void,
): void {
  for (const id of expected)
    if (!registration.facets.includes(id))
      fail('HOST_CONTRACT_GRAPH_LINK_MISSING', `${registration.identity}/${id}`);
  for (const id of registration.facets)
    if (!expected.has(id)) fail('HOST_CONTRACT_GRAPH_LINK_EXTRA', `${registration.identity}/${id}`);
}
function validateLinkedLanes(
  handler: HostHandlerRegistration,
  lanes: readonly GraphLane[],
  nodes: readonly OwnedNode[],
  fail: (code: string, id: string) => void,
): void {
  for (const node of nodes)
    for (const lane of lanes)
      if (
        applies(lane, handler) &&
        node.lanes.every(row => !(row.id === lane.id && row.applicable))
      )
        fail('HOST_CONTRACT_GRAPH_LANE_LINK_MISSING', `${node.id}/${lane.id}`);
}
function validateGraph(
  root: string,
  allNodes: readonly OwnedNode[],
  registrations: readonly { identity: string; facets: string[] }[],
  fail: (code: string, id: string) => void,
): void {
  for (const node of allNodes) {
    if (!node.owner || !existsAt(root, node.owner))
      fail('HOST_CONTRACT_GRAPH_OWNER_MISSING', node.owner || node.id);
    if (allNodes.filter(other => other.id === node.id).length !== 1)
      fail('HOST_CONTRACT_GRAPH_NODE_DUPLICATE', node.id);
  }
  for (const registration of registrations) {
    if (registrations.filter(row => row.identity === registration.identity).length !== 1)
      fail('HOST_CONTRACT_GRAPH_REGISTRATION_DUPLICATE', registration.identity);
    for (const id of registration.facets)
      if (allNodes.filter(node => node.id === id).length !== 1)
        fail('HOST_CONTRACT_GRAPH_FACET_UNRESOLVED', id);
  }
}

function existsAt(root: string, path: string): boolean {
  try {
    return readFileSync(nodePath.join(root, path)).length > 0;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}
class CaptureInputError extends Error {}
function git(root: string, args: string[], input?: string): Buffer {
  return execFileSync('git', args, {
    cwd: root,
    timeout: 30_000,
    maxBuffer: 64 * 1024 * 1024,
    input,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}
/** Raw Git inputs, not a second semantic inventory or executable candidate checkout. */
function committedInputs(root: string, commit: string) {
  const roots = [
    'packages/cli/',
    'packages/opencode-v2-plugin/',
    'scripts/',
    'plugin/',
    '.claude/',
    '.cursor/',
    '.safeword/',
    '.agents/',
  ];
  const entries = git(root, ['ls-tree', '-rz', '--full-tree', commit])
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .map(entry => {
      const [header, path = ''] = entry.split('\t', 2);
      const [mode, type, blob] = (header ?? '').split(' ', 3);
      return { mode, type, blob: blob ?? '', path };
    })
    .filter(
      entry => !entry.path.includes('/') || roots.some(prefix => entry.path.startsWith(prefix)),
    );
  if (
    entries.some(entry => !['100644', '100755'].includes(entry.mode ?? '') || entry.type !== 'blob')
  )
    throw new CaptureInputError('OWNER_CAPTURE_UNSUPPORTED_TREE_ENTRY');
  const batch = git(
    root,
    ['cat-file', '--batch'],
    `${entries.map(entry => entry.blob).join('\n')}\n`,
  );
  let offset = 0;
  const sources = entries.map(entry => {
    const newline = batch.indexOf(10, offset);
    const [blob, type, length] = batch.subarray(offset, newline).toString('utf8').split(' ', 3);
    const size = Number(length),
      start = newline + 1;
    if (
      newline < offset ||
      blob !== entry.blob ||
      type !== 'blob' ||
      !Number.isSafeInteger(size) ||
      size < 0 ||
      start + size >= batch.length
    )
      throw new CaptureInputError('OWNER_CAPTURE_INVALID_BLOB_STREAM');
    const bytes = batch.subarray(start, start + size);
    offset = start + size + 1;
    return { path: entry.path, blob: entry.blob, sha256: hashBytes(bytes) };
  });
  return {
    tree: git(root, ['rev-parse', commit.concat('^{tree}')])
      .toString('utf8')
      .trim(),
    sources,
  };
}
function currentInputMismatches(
  root: string,
  sources: ReturnType<typeof committedInputs>['sources'],
): Finding[] {
  return sources.flatMap(row => {
    try {
      if (hashBytes(readFileSync(nodePath.join(root, row.path))) === row.sha256) return [];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    return [
      {
        code: 'OWNER_CAPTURE_CURRENT_INPUT_MISMATCH',
        severity: 'error' as const,
        message: row.path,
        metadata: { path: row.path },
      },
    ];
  });
}
function currentGraphReport(root: string) {
  // This is the executing trusted controller's public check, never candidate code.
  const result = spawnSync(
    process.execPath,
    ['packages/cli/scripts/check-host-contract.ts', '--json'],
    {
      cwd: root,
      encoding: 'utf8',
      timeout: 120_000,
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  if (result.error || result.signal || result.status === null || result.status === 3)
    throw new Error(`OWNER_CAPTURE_GRAPH_UNAVAILABLE: ${result.error?.message ?? result.stderr}`);
  const report = JSON.parse(result.stdout) as {
    errors: unknown[];
    findings: Finding[];
    data: {
      scope: string;
      inventory_complete: boolean;
      ownership_graph: ReturnType<typeof repoOwnershipGraph>['graph'];
    };
  };
  if (report.errors.length > 0) throw new Error('OWNER_CAPTURE_GRAPH_ERRORS');
  return { result, report };
}
async function currentOwnership(
  root: string,
  inputs: ReturnType<typeof committedInputs>,
): Promise<{
  findings: Finding[];
  graph?: ReturnType<typeof repoOwnershipGraph>['graph'];
  scope?: string;
  oracleInputs?: Awaited<ReturnType<typeof intendedCurrentGraph>>['oracleInputs'];
}> {
  const findings = currentInputMismatches(root, inputs.sources);
  if (findings.length > 0) return { findings };
  const { result, report } = currentGraphReport(root);
  findings.push(...report.findings, ...currentInputMismatches(root, inputs.sources));
  if (result.status !== 0 || !report.data.inventory_complete) {
    findings.push({
      code: 'OWNER_CAPTURE_GRAPH_INCOMPLETE',
      severity: 'error',
      message: 'The actual current repository check is incomplete.',
    });
    return { findings };
  }
  const independent = await intendedCurrentGraph(root, inputs, report.data.ownership_graph);
  findings.push(...independent.findings);
  return { ...independent, findings, graph: report.data.ownership_graph, scope: report.data.scope };
}
async function intendedCurrentGraph(
  root: string,
  inputs: ReturnType<typeof committedInputs>,
  ownedGraph: ReturnType<typeof repoOwnershipGraph>['graph'],
) {
  const findings: Finding[] = [];
  // Fixed trusted independent intended data; no candidate imports or success JSON.
  const intended = await import('../../tests/helpers/intended-contract-graph.js');
  const fixtureRoot = 'packages/cli/tests/fixtures/host-contract/';
  const sourceOracle = JSON.parse(
    readFileSync(nodePath.join(root, fixtureRoot, 'intended-sources.json'), 'utf8'),
  ) as { paths: string[]; additions: string[] };
  const ordered = (rows: unknown[]) =>
    rows.map(row => JSON.stringify(row)).toSorted((a, b) => a.localeCompare(b));
  const exact = (id: string, observed: unknown[], expected: unknown[]) => {
    if (JSON.stringify(ordered(observed)) !== JSON.stringify(ordered(expected)))
      findings.push({
        code: `OWNER_CAPTURE_${id}_MISMATCH`,
        severity: 'error',
        message: `Independent committed ${id} exact set differs.`,
      });
  };
  exact(
    'FACETS',
    ownedGraph.facets.map(row => [row.path, row.owner]),
    [...sourceOracle.paths, ...sourceOracle.additions].map(path => [
      path,
      intended.intendedFacetOwner(path),
    ]),
  );
  exact(
    'REGISTRATIONS',
    ownedGraph.registrations.map(row => [row.identity, row.owner]),
    intended
      .intendedRegistrations()
      .map(row => [
        intended.intendedRegistrationIdentity(row),
        intended.intendedRegistrationOwner(row),
      ]),
  );
  const oracleFiles = [
    'intended-sources.json',
    'intended-current-registrations.json',
    'targets.json',
    'owners/cursor-rule-purposes-baseline.txt',
  ].map(path => `${fixtureRoot}${path}`);
  oracleFiles.push('packages/cli/tests/helpers/intended-contract-graph.ts');
  const oracleInputs = oracleFiles.map(path => inputs.sources.find(row => row.path === path));
  if (oracleInputs.includes(undefined))
    findings.push({
      code: 'OWNER_CAPTURE_ORACLE_MISSING',
      severity: 'error',
      message: 'Independent intended fixture has no committed blob.',
    });
  const captured = new Set(inputs.sources.map(row => row.path));
  for (const owner of [
    ...ownedGraph.facets.map(row => row.path),
    ...ownedGraph.facets.map(row => row.owner),
    ...ownedGraph.handler_facets.map(row => row.owner),
  ])
    if (!captured.has(owner))
      findings.push({ code: 'OWNER_CAPTURE_SOURCE_MISSING', severity: 'error', message: owner });
  findings.push(...currentInputMismatches(root, inputs.sources));
  return { findings, oracleInputs };
}
function revision(root: string, value: string): string {
  return git(root, ['rev-parse', '--verify', '--end-of-options', value.concat('^{commit}')])
    .toString('utf8')
    .trim();
}
function graph(root: string, commit: string) {
  const scratch = mkdtempSync(nodePath.join(tmpdir(), 'safeword-owner-graph-'));
  try {
    const paths = [...HOST_CONTRACT_OWNER_SOURCES, ...oracle.retained].toSorted((a, b) =>
      a.localeCompare(b),
    );
    const sources = paths.map(path => {
      const entry = git(root, ['ls-tree', commit, '--', path]).toString('utf8');
      if (!/^100(?:644|755) blob /u.test(entry))
        throw new CaptureInputError(`OWNER_CAPTURE_SOURCE_MISSING: ${path}`);
      const text = git(root, ['cat-file', 'blob', `${commit}:${path}`]);
      const target = nodePath.join(scratch, path);
      mkdirSync(nodePath.dirname(target), { recursive: true });
      writeFileSync(target, text);
      return { path, sha256: hashBytes(text) };
    });
    const findings = findCompetingHostContractOwners(scratch);
    const owners = [
      ...new Set(findings.map(finding => String(finding.metadata?.owner_id))),
    ].toSorted((a, b) => a.localeCompare(b));
    return { commit, sources, owners, findings, sha256: digest({ sources, owners }) };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
function revisionOption(value: string | undefined): string {
  if (!value || value.startsWith('-'))
    throw new CaptureInputError('Invalid capture revision option');
  return value;
}
function options(args: readonly string[]) {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index++) {
    const argument = args[index] ?? '';
    if (values.has(argument)) throw new CaptureInputError('Duplicate capture option');
    if (['--owner-delta', '--json'].includes(argument)) values.set(argument, 'true');
    else if (['--baseline', '--candidate'].includes(argument))
      values.set(argument, revisionOption(args[++index]));
    else
      throw new CaptureInputError(
        `Caller-authored evidence or unknown option is not accepted: ${argument}`,
      );
  }
  const baseline = values.get('--baseline'),
    candidate = values.get('--candidate');
  if (!baseline || !candidate) throw new CaptureInputError('Both committed revisions are required');
  return { baseline, candidate };
}

/** Read committed blobs with the executing controller; never execute candidate imports or accept savings. */
export async function captureOwnerDelta(root: string, args: readonly string[]) {
  try {
    const input = options(args);
    const project = realpathSync(root);
    const beforeShape = graph(project, revision(project, input.baseline));
    const afterShape = graph(project, revision(project, input.candidate));
    const before = { ...beforeShape, ...committedInputs(project, beforeShape.commit) };
    const afterInputs = committedInputs(project, afterShape.commit);
    const after = { ...afterShape, ...afterInputs };
    const missing = oracle.retired.filter(id => !before.owners.includes(id));
    const unaccounted = before.owners.filter(id => !oracle.retired.includes(id));
    const findings = [
      ...after.findings,
      ...unaccounted.map(id => ({
        code: 'OWNER_CAPTURE_BASELINE_UNACCOUNTED',
        severity: 'error' as const,
        message: `Baseline authority has no independent intended mapping: ${id}`,
        metadata: { owner_id: id },
      })),
      ...missing.map(id => ({
        code: 'OWNER_CAPTURE_BASELINE_INCOMPLETE',
        severity: 'error' as const,
        message: `Expected baseline authority missing: ${id}`,
        metadata: { owner_id: id },
      })),
    ];
    const retired = oracle.retired.filter(
      id => before.owners.includes(id) && !after.owners.includes(id),
    );
    const current =
      findings.length > 0 ? { findings: [] } : await currentOwnership(project, afterInputs);
    findings.push(...current.findings);
    const complete = findings.length === 0 && current.graph !== undefined;
    const outcome = complete ? 'passed' : 'failed';
    const candidate = { ...after, ownership_graph: current.graph, graph_scope: current.scope };
    const retained = [
      ...new Set([
        ...oracle.retained,
        ...(current.graph?.facets.filter(row => row.path !== row.owner).map(row => row.path) ?? []),
      ]),
    ];
    const payload = {
      kind: 'owner-inventory',
      scope: oracle.scope,
      project_directory: project,
      controller_sha256: hashBytes(readFileSync(import.meta.filename, 'utf8')),
      detector_sha256: hashBytes(
        readFileSync(nodePath.join(import.meta.dirname, 'source-ownership.ts'), 'utf8'),
      ),
      oracle_sha256: digest({ oracle, inputs: current.oracleInputs }),
      baseline: { ...before, sha256: digest(before) },
      candidate: { ...candidate, sha256: digest(candidate) },
      retirement_basis: 'committed-source-graph-and-known-retirement-shapes',
      // Identical capture replay returns its original record; it never advances the history head.
      replay_advances_history: false,
      retired_owners: retired,
      retained_mechanical_translations: retained,
      intended_purpose_owners: oracle.intended_purpose_owners,
      unadjudicated_baseline_owners: unaccounted,
      outcome,
      inventory_complete: complete,
      admission_eligible: false,
    };
    return publishOwnerCapture(project, payload, findings);
  } catch (error) {
    const invalid = error instanceof CaptureInputError;
    return createResult({
      state: 'failed',
      exitCode: invalid ? 2 : 3,
      errors: [
        {
          code: invalid ? 'OWNER_CAPTURE_INPUT_INVALID' : 'OWNER_CAPTURE_UNAVAILABLE',
          message: error instanceof Error ? error.message : String(error),
          retryable: false,
        },
      ],
    });
  }
}

function publishOwnerCapture(
  project: string,
  payload: Record<string, unknown> & { kind: string; inventory_complete: boolean },
  findings: Finding[],
) {
  const bucket = digest({ kind: payload.kind, project });
  const state = process.env.XDG_STATE_HOME ?? nodePath.join(homedir(), '.local/state');
  if (!nodePath.isAbsolute(state))
    throw new CaptureInputError('Profile state root must be absolute');
  const record = publishConformanceAttempt(
    {
      directory: nodePath.join(project, CONFORMANCE_RUN_LAYOUT.directory, bucket),
      keyFile: nodePath.join(state, CONFORMANCE_RUN_LAYOUT.key),
      headFile: nodePath.join(state, CONFORMANCE_RUN_LAYOUT.heads, `${bucket}.json`),
    },
    payload,
    digest(payload),
  );
  return createResult({
    state: findings.length > 0 ? 'failed' : 'healthy',
    exitCode: findings.length > 0 ? 2 : 0,
    findings,
    data: {
      command: 'host-contract owner-delta',
      owner_delta: payload,
      record_id: record.id,
      record_integrity: record.integrity,
      inventory_complete: payload.inventory_complete,
      admission_eligible: false,
    },
  });
}
