export interface ProjectIdentity {
  readonly kind: 'git' | 'directory';
  readonly projectKey: string;
  readonly worktreeKey: string;
}

export interface GlobalProjectPaths {
  readonly partitionRoot: string;
  readonly partitionMarker: string;
  readonly namespaceRoot: string;
  readonly stateRoot: string;
}

export interface ProjectStorageContext {
  readonly authority: 'local' | 'global';
  readonly workspaceRoot: string;
  readonly namespaceRoot: string;
  readonly stateRoot: string;
}

export type ContextResolution =
  | { readonly kind: 'ready'; readonly context: ProjectStorageContext }
  | {
      readonly kind: 'choice-required';
      readonly workspaceRoot: string;
      readonly containingProject?: string;
      readonly globalPaths: GlobalProjectPaths;
    };
