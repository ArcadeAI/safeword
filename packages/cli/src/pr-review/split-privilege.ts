export interface SplitPrivilegeInspectionAudit {
  checkout: false;
  customerCodeExecution: false;
  githubPermissions: { contents: 'read'; pullRequests: 'read' };
  githubWriteCredential: false;
}

export interface SplitPrivilegePublicationAudit {
  executableArtifacts: [];
  forkCodeInputs: [];
  soleInput: 'serialized_advisory_evidence';
}

export interface SplitPrivilegeReviewDependencies {
  artifacts: string[];
  inspect(request: {
    artifacts: string[];
    authority: SplitPrivilegeInspectionAudit;
  }): Promise<{ reviewedArtifacts: string[] }>;
  publish(serializedEvidence: string): Promise<{ artifacts: string[] }>;
}

export interface SplitPrivilegeReviewResult {
  inspectionAudit: SplitPrivilegeInspectionAudit;
  publicationAudit: SplitPrivilegePublicationAudit;
  receipt: { artifacts: string[] };
}

export interface ValidatedPublicationDependencies {
  inspectionAudit?: unknown;
  publicationAudit?: unknown;
  publish(): Promise<void>;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasValidInspectionAudit(value: unknown): boolean {
  if (!isObject(value) || !isObject(value.githubPermissions)) return false;
  return (
    value.checkout === false &&
    value.customerCodeExecution === false &&
    value.githubWriteCredential === false &&
    value.githubPermissions.contents === 'read' &&
    value.githubPermissions.pullRequests === 'read'
  );
}

function hasValidPublicationAudit(value: unknown): boolean {
  if (!isObject(value)) return false;
  return (
    value.soleInput === 'serialized_advisory_evidence' &&
    Array.isArray(value.executableArtifacts) &&
    value.executableArtifacts.length === 0 &&
    Array.isArray(value.forkCodeInputs) &&
    value.forkCodeInputs.length === 0
  );
}

export async function publishValidatedSplitPrivilegeEvidence(
  dependencies: ValidatedPublicationDependencies,
): Promise<{ publicationBlocked: boolean }> {
  if (
    !hasValidInspectionAudit(dependencies.inspectionAudit) ||
    !hasValidPublicationAudit(dependencies.publicationAudit)
  ) {
    return { publicationBlocked: true };
  }

  await dependencies.publish();
  return { publicationBlocked: false };
}

export async function runSplitPrivilegeReview(
  dependencies: SplitPrivilegeReviewDependencies,
): Promise<SplitPrivilegeReviewResult> {
  const inspectionAudit: SplitPrivilegeInspectionAudit = {
    checkout: false,
    customerCodeExecution: false,
    githubPermissions: { contents: 'read', pullRequests: 'read' },
    githubWriteCredential: false,
  };
  const inspection = await dependencies.inspect({
    artifacts: [...dependencies.artifacts],
    authority: inspectionAudit,
  });
  const serializedEvidence = JSON.stringify({
    inspectionAudit,
    reviewedArtifacts: inspection.reviewedArtifacts,
    schemaVersion: 1,
  });
  const receipt = await dependencies.publish(serializedEvidence);

  return {
    inspectionAudit,
    publicationAudit: {
      executableArtifacts: [],
      forkCodeInputs: [],
      soleInput: 'serialized_advisory_evidence',
    },
    receipt,
  };
}
