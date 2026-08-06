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
