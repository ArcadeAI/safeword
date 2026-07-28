import nodePath from 'node:path';
import process from 'node:process';

import { type CliResult, createResult } from '../cli-protocol/result.js';
import { exists } from '../utils/fs.js';
import { withOutputMuted } from '../utils/output.js';
import { createReconciliationPlan } from './reconciliation-plan.js';

export async function convergeSetup(
  cwd: string,
  options: { noModify?: boolean },
): Promise<CliResult> {
  const previousDirectory = process.cwd();
  try {
    const configured = exists(nodePath.join(cwd, '.safeword'));
    const { dryRun, plan } = await createReconciliationPlan(cwd, 'upgrade');

    process.chdir(cwd);
    await withOutputMuted(async () => {
      if (configured) {
        const { upgrade } = await import('./upgrade.js');
        await upgrade({ noModify: options.noModify });
      } else {
        const { setup } = await import('./setup.js');
        await setup({ noModify: options.noModify });
      }
    });
    const installedPackages =
      process.env.SAFEWORD_SKIP_INSTALL === undefined && plan.effects.packages.length > 0;
    const changed =
      dryRun.actions.some(action => ['mkdir', 'rmdir', 'write', 'rm'].includes(action.type)) ||
      installedPackages;

    return createResult({
      state: changed ? 'changed' : 'healthy',
      changed,
      effects: changed ? plan.effects : undefined,
      data: { configured: true },
    });
  } catch (setupError) {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'SETUP_FAILED',
          message: setupError instanceof Error ? setupError.message : String(setupError),
          retryable: true,
        },
      ],
      recovery: [
        {
          command: 'safeword status --verbose',
          description: 'Inspect the partial project state before retrying setup.',
          requiresHuman: true,
        },
      ],
    });
  } finally {
    process.chdir(previousDirectory);
  }
}
