import assert from 'node:assert/strict';

import type { CanonicalCatalogueInputs } from '../../tests/helpers/native-catalogue-probe.js';
import {
  policyCompletion,
  type PolicyRow,
  type PropagationGrade,
} from './propagation-policy-grade.js';
import type {
  PropagationLane,
  RetainedPolicyActor,
  RetainedResourceActor,
} from './resource-propagation.js';

export function requireGrade(grade: PropagationGrade): void {
  if (grade.exit) throw new PropagationOutcomeError(grade);
}

export class PropagationOutcomeError extends Error {
  constructor(readonly grade: PropagationGrade) {
    super(grade.failures.join('\n'));
  }
}

/** Optional policy phases share the resource controller's exact actor population. */
export class RetainedPolicyPhases {
  private readonly fingerprints = new Map<string, ReturnType<RetainedPolicyActor['fingerprint']>>();
  private readonly scope = '**PR Scope:** ✅ Synthetic fixture matches its scope\n';
  readonly observations = {
    baseline: [] as PolicyRow[],
    changed: [] as PolicyRow[],
    repaired: [] as PolicyRow[],
    finalDenied: [] as PolicyRow[],
    finalAllowed: [] as PolicyRow[],
  };
  constructor(
    private readonly required: PropagationLane[],
    private readonly actors: Map<string, RetainedResourceActor>,
    private readonly identities: Map<string, string>,
    private readonly plan: { inputs: CanonicalCatalogueInputs; marker: string },
  ) {}

  private actor(lane: PropagationLane) {
    return this.actors.get(lane.id) as RetainedPolicyActor;
  }
  private fingerprint(lane: PropagationLane) {
    const value = this.actor(lane).fingerprint();
    assert.equal(
      value.resources.length,
      3,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: resource fingerprint missing',
    );
    for (const hash of [...value.resources, value.policy])
      assert.match(
        hash,
        /^[a-f0-9]{64}$/u,
        'HOST_CONTRACT_PROOF_UNAVAILABLE: malformed fingerprint',
      );
    return value;
  }
  private async collect(rows: PolicyRow[], evidence: string, setup: string, denied: boolean) {
    for (const lane of this.required) {
      const observed = await this.actor(lane).observeVerification(evidence, setup);
      rows.push({ lane: lane.id, observed }); // Preserve the original concrete observation object.
      assert.ok(
        observed.observation.installation,
        'HOST_CONTRACT_PROOF_UNAVAILABLE: policy installation identity missing',
      );
      requireGrade({
        exit: observed.observation.installation === this.identities.get(lane.id) ? 0 : 2,
        failures: [`PROPAGATION_INSTALLATION_REPLACED:${lane.id}`],
      });
    }
    requireGrade(policyCompletion(this.required, rows, denied, this.plan.marker));
  }
  private get valid() {
    return `${this.scope}\n${this.plan.marker}\n`;
  }

  async start() {
    for (const lane of this.required) this.fingerprints.set(lane.id, this.fingerprint(lane));
    await this.collect(this.observations.baseline, this.scope, this.scope, false);
    for (const lane of this.required) await this.actor(lane).refreshResources(this.plan.inputs);
    for (const lane of this.required) {
      const before = this.fingerprints.get(lane.id);
      const after = this.fingerprint(lane);
      const resources = JSON.stringify(before?.resources) === JSON.stringify(after.resources);
      requireGrade({
        exit: resources ? 0 : 2,
        failures: [`PROPAGATION_POLICY_CHANGED_RESOURCES:${lane.id}`],
      });
      requireGrade({
        exit: before?.policy === after.policy ? 2 : 0,
        failures: [`PROPAGATION_POLICY_BYTES_STALE:${lane.id}`],
      });
      this.fingerprints.set(lane.id, after);
    }
    await this.collect(this.observations.changed, this.scope, this.valid, true);
    await this.collect(this.observations.repaired, this.valid, this.valid, false);
  }
  async finish() {
    for (const lane of this.required) {
      const after = this.fingerprint(lane);
      const before = this.fingerprints.get(lane.id);
      requireGrade({
        exit: before?.policy === after.policy ? 0 : 2,
        failures: [`PROPAGATION_RESOURCES_CHANGED_POLICY:${lane.id}`],
      });
      requireGrade({
        exit: after.resources.every((hash, index) => hash !== before?.resources[index]) ? 0 : 2,
        failures: [`PROPAGATION_RESOURCE_BYTES_STALE:${lane.id}`],
      });
    }
    await this.collect(this.observations.finalDenied, this.scope, this.valid, true);
    await this.collect(this.observations.finalAllowed, this.valid, this.valid, false);
  }
}
