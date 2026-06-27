/**
 * The two writers behind one shared client port (JS5K5G AC4, AC7). v1 uses only
 * stable create/update, so the Linear and GitHub writer *logic* is identical —
 * the provider divergence (bot identity, attachment vs body back-link) lives in
 * the injected TrackerClient adapter, not here. Two writer instances, one per
 * provider, with no duplicated logic (rule of three: don't abstract early).
 *
 * Field ownership (AC7) is structural: the update request can only ever carry
 * title, labels, and — for a terminal ticket — `state: 'closed'` (the one
 * universal status write). It has no assignee/priority field to set, so safeword
 * cannot stomp the human-owned fields even by accident.
 */

import type { IssuePayload, Provider, TrackerReference } from './types.js';

export interface CreateRequest {
  title: string;
  body: string;
  labels: string[];
}

/** Only the owned fields are settable; `state` appears only to close (AC7). */
export interface UpdateRequest {
  id: string;
  title: string;
  labels: string[];
  state?: 'closed';
}

export interface GraphProjection {
  parent?: TrackerReference;
  blockedBy: TrackerReference[];
}

export interface GraphRequest {
  id: string;
  issueType: string;
  parentId?: string;
  blockedByIds: string[];
}

/** The provider-neutral port each provider adapter implements (Arcade / gh). */
export interface TrackerClient {
  createIssue(request: CreateRequest): Promise<{ id: string; url?: string }>;
  updateIssue(request: UpdateRequest): Promise<void>;
  projectGraph(request: GraphRequest): Promise<void>;
}

export interface TrackerWriter {
  readonly provider: Provider;
  create(payload: IssuePayload): Promise<TrackerReference>;
  update(ref: TrackerReference, payload: IssuePayload): Promise<void>;
  projectGraph(ref: TrackerReference, payload: IssuePayload, graph: GraphProjection): Promise<void>;
}

/** Build a writer for `provider` over an injected client. */
export function createWriter(provider: Provider, client: TrackerClient): TrackerWriter {
  return {
    provider,
    async create(payload) {
      const created = await client.createIssue({
        title: payload.title,
        body: payload.body,
        labels: payload.labels,
      });
      return { provider, id: created.id, url: created.url };
    },
    async update(ref, payload) {
      const request: UpdateRequest = { id: ref.id, title: payload.title, labels: payload.labels };
      // The one universal status write: close when the ticket is terminal.
      if (payload.state === 'closed') request.state = 'closed';
      await client.updateIssue(request);
    },
    async projectGraph(ref, payload, graph) {
      await client.projectGraph({
        id: ref.id,
        issueType: payload.issueType,
        parentId: graph.parent?.id,
        blockedByIds: graph.blockedBy.map(blocker => blocker.id),
      });
    },
  };
}

/** Route a create through the registry's writer for `provider` (AC4 call site). */
export function dispatchCreate(
  registry: Record<Provider, TrackerWriter>,
  provider: Provider,
  payload: IssuePayload,
): Promise<TrackerReference> {
  return registry[provider].create(payload);
}
