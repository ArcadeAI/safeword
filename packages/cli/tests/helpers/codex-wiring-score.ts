interface CapabilityFixture {
  readonly id: string;
  readonly verdict: 'approve' | 'request_changes';
  readonly required: readonly string[];
  readonly forbidden: readonly string[];
  /** All concept groups must occur in ONE blocking finding; each group lists alternatives.
   * This is a bounded lexical oracle, not a semantic judge of arbitrary reviewer prose.
   */
  readonly finding_groups?: readonly (readonly string[])[];
}

export interface CapabilityRun {
  readonly fixture_id: string;
  readonly run: number;
  readonly verdict: 'approve' | 'request_changes' | 'invalid';
  readonly failure?: 'review_failed' | 'model_unconfirmed' | 'identity_mismatch';
  readonly findings: readonly {
    readonly severity: 'info' | 'warning' | 'error';
    readonly message: string;
  }[];
}

function findingMatchesConceptGroups(
  message: string,
  groups: NonNullable<CapabilityFixture['finding_groups']>,
): boolean {
  const words = ` ${message.replaceAll(/[^\p{L}\p{N}]+/gu, ' ')}`;
  return groups.every(group =>
    group.some(
      concept =>
        concept.trim() !== '' &&
        words.includes(` ${concept.toLowerCase().replaceAll(/[^\p{L}\p{N}]+/gu, ' ')}`),
    ),
  );
}

export function scoreCapabilityRun(fixture: CapabilityFixture, run: CapabilityRun): boolean {
  const normalizedFindings = run.findings.map(finding => ({
    severity: finding.severity,
    message: finding.message.toLowerCase().replaceAll(/\s+/gu, ' '),
  }));
  const contains = (phrase: string, errorOnly: boolean): boolean =>
    normalizedFindings.some(
      finding =>
        (!errorOnly || finding.severity === 'error') &&
        finding.message.includes(phrase.toLowerCase().replaceAll(/\s+/gu, ' ')),
    );
  const groups = fixture.finding_groups;
  return (
    run.fixture_id === fixture.id &&
    run.verdict === fixture.verdict &&
    (run.verdict === 'request_changes') ===
      normalizedFindings.some(finding => finding.severity === 'error') &&
    fixture.required.every(finding => contains(finding, true)) &&
    fixture.forbidden.every(finding => !contains(finding, false)) &&
    (groups === undefined ||
      (groups.length > 0 &&
        normalizedFindings.some(
          finding =>
            finding.severity === 'error' && findingMatchesConceptGroups(finding.message, groups),
        )))
  );
}
