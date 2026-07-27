import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DISPOSABLE_PREFIX = 'safeword-relay-spike-';
const UUID_SEGMENT_LENGTHS = [8, 4, 4, 4, 12];

export interface SpikeState {
  projectId: string;
  projectName: string;
  environmentId: string;
  serviceId: string;
  volumeId: string;
}

export interface SpikeTopology {
  services: {
    id: string;
    replicas: { configured: number; running: number };
    volumes: { mountPath: string }[];
  }[];
  volumes: { id: string; mountPath: string; serviceName: string }[];
}

function assertUuid(value: string, name: string): void {
  const segments = value.split('-');
  const valid =
    segments.length === UUID_SEGMENT_LENGTHS.length &&
    segments.every(
      (segment, index) =>
        segment.length === UUID_SEGMENT_LENGTHS.at(index) && /^[\da-f]+$/u.test(segment),
    );
  if (!valid) throw new Error(`invalid ${name}`);
}

export function assertDisposableState(state: SpikeState): void {
  if (!state.projectName.startsWith(DISPOSABLE_PREFIX)) {
    throw new Error('project is not a disposable Safeword relay spike');
  }
  for (const [name, value] of [
    ['projectId', state.projectId],
    ['environmentId', state.environmentId],
    ['serviceId', state.serviceId],
    ['volumeId', state.volumeId],
  ]) {
    assertUuid(value, name);
  }
}

export function validateSpikeTopology(topology: SpikeTopology, state: SpikeState): void {
  assertDisposableState(state);
  if (topology.services.length !== 1) throw new Error('service count mismatch');
  const [service] = topology.services;
  if (service.id !== state.serviceId) {
    throw new Error('service ID mismatch');
  }
  if (service.replicas.configured !== 1 || service.replicas.running !== 1) {
    throw new Error('replica count mismatch');
  }
  validateVolume(topology, service, state.volumeId);
}

function validateVolume(
  topology: SpikeTopology,
  service: SpikeTopology['services'][number],
  volumeId: string,
): void {
  if (topology.volumes.length !== 1 || service.volumes.length !== 1) {
    throw new Error('volume count mismatch');
  }
  const [volume] = topology.volumes;
  const [serviceVolume] = service.volumes;
  if (
    volume.id !== volumeId ||
    volume.mountPath !== '/data' ||
    serviceVolume.mountPath !== '/data'
  ) {
    throw new Error('volume mount mismatch');
  }
}

export function teardownPreview(state: SpikeState): string[] {
  assertDisposableState(state);
  return ['railway', 'project', 'delete', '--project', state.projectId, '--yes', '--json'];
}

export function validateSpikeReport(report: string, configuredSecrets: string[] = []): void {
  for (const heading of [
    '## Outcome',
    '## Live topology',
    '## Non-filing evidence',
    '## Resource and cost snapshot',
    '## Limitations and promotion gates',
    '## Teardown preview',
  ]) {
    if (!report.includes(heading)) throw new Error(`missing report section: ${heading}`);
  }
  if (configuredSecrets.some(secret => secret.length >= 8 && report.includes(secret))) {
    throw new Error('report contains configured credential material');
  }
}

export async function writeSpikeStateAtomic(filePath: string, state: SpikeState): Promise<void> {
  assertDisposableState(state);
  const directory = path.dirname(filePath);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Validated state is written to the caller-selected transient evidence path.
  await mkdir(directory, { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- The temporary path is derived from the caller-selected target.
  await writeFile(temporaryPath, `${JSON.stringify(state, undefined, 2)}\n`, { mode: 0o600 });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Atomic rename stays within the caller-selected directory.
  await rename(temporaryPath, filePath);
}
