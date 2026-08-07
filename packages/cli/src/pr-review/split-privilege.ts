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
