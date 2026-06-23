/**
 * `safeword self-report` — view safeword's own captured runtime signals
 * (ticket QYYC5Y, issue #345).
 *
 * Read-only viewer over the zero-egress local spool that the hooks write to
 * (`.safeword/self-reports/*.jsonl`). Aggregates records by signature so a
 * maintainer can see what safeword did wrong, this session and recently. No
 * sanitizing happens here — nothing sensitive was ever written (see
 * templates/hooks/lib/self-report.ts).
 */

import process from 'node:process';

import {
  readReports,
  type SelfReportRecord,
  summarizeReports,
} from '../../templates/hooks/lib/self-report.js';
import { header, info, listItem } from '../utils/output.js';

export interface SelfReportOptions {
  json?: boolean;
}

export function selfReport(
  options: SelfReportOptions = {},
  cwd: string = process.env.CLAUDE_PROJECT_DIR ?? process.cwd(),
): Promise<void> {
  const records: SelfReportRecord[] = readReports(cwd);
  const groups = summarizeReports(records);

  if (options.json) {
    info(JSON.stringify({ total: records.length, groups }, undefined, 2));
    return Promise.resolve();
  }

  if (records.length === 0) {
    info('No safeword self-reports captured. (Nothing to report — good.)');
    return Promise.resolve();
  }

  header(`Safeword self-reports (${records.length} signal(s), ${groups.length} signature(s))`);
  for (const group of groups) {
    listItem(`${group.count}×  ${group.signature}`);
  }
  return Promise.resolve();
}
