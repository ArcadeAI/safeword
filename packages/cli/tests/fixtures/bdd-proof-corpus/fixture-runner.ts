import { spawnSync } from 'node:child_process';

export interface FixtureEvidence {
  readonly environment: 'sanitized';
  readonly evidenceClass: 'fixture';
  readonly requestedHostScope: 'claude';
  readonly unrelatedPluginVisible: boolean;
  readonly status: number | null;
}

export function runApprovedCliFixture(
  cli: string,
  hostScope: 'claude',
  sourceEnvironment: NodeJS.ProcessEnv = process.env,
): FixtureEvidence {
  const environment = {
    PATH: sourceEnvironment.PATH,
    SAFEWORD_FIXTURE_HOST: hostScope,
    SAFEWORD_NO_UPDATE_CHECK: '1',
  };
  const probe = spawnSync(
    process.execPath,
    [
      '-e',
      'process.stdout.write(JSON.stringify({host:process.env.SAFEWORD_FIXTURE_HOST,unrelated:process.env.SAFEWORD_UNRELATED_PLUGIN}))',
    ],
    { encoding: 'utf8', env: environment },
  );
  if (probe.error) throw probe.error;
  if (probe.status !== 0) throw new Error(`Fixture environment probe exited ${probe.status}`);
  const observed = JSON.parse(probe.stdout) as { host?: string; unrelated?: string };
  if (observed.host !== hostScope) {
    throw new Error(`Fixture environment probe observed unexpected host: ${String(observed.host)}`);
  }
  const execution = spawnSync(process.execPath, [cli, '--help'], {
    encoding: 'utf8',
    env: environment,
  });
  if (execution.error) throw execution.error;
  if (execution.status === null) {
    throw new Error(
      `Fixture CLI terminated by signal ${execution.signal ?? 'unknown'}: ${execution.stderr.trim()}`,
    );
  }
  return {
    environment: 'sanitized',
    evidenceClass: 'fixture',
    requestedHostScope: observed.host,
    unrelatedPluginVisible: observed.unrelated !== undefined,
    status: execution.status,
  };
}
