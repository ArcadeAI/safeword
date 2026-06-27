/**
 * Read the `ticketBridge` block from `.safeword/config.json` (JS5K5G). The WRITE
 * side (interactive setup / secrets) is owned by the connect-flow ticket 2TK5AD;
 * this is the read side the command consumes. Default is the no-tracker base
 * case — `provider: none`, `body: minimal` — so an unconfigured repo is inert.
 */

import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import type { TicketBridgeConfig } from './index.js';

const DEFAULT_CONFIG: TicketBridgeConfig = { provider: 'none', body: 'minimal' };

/** Read `.safeword/config.json` → `ticketBridge`, falling back to the inert default. */
export function readTicketBridgeConfig(cwd: string): TicketBridgeConfig {
  const configPath = nodePath.join(cwd, '.safeword', 'config.json');
  if (!existsSync(configPath)) return { ...DEFAULT_CONFIG };
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(configPath, 'utf8'));
  } catch {
    return { ...DEFAULT_CONFIG };
  }
  if (typeof parsed !== 'object' || parsed === null || !('ticketBridge' in parsed)) {
    return { ...DEFAULT_CONFIG };
  }
  const bridge = parsed.ticketBridge;
  if (typeof bridge !== 'object' || bridge === null) return { ...DEFAULT_CONFIG };
  const block = bridge as Partial<TicketBridgeConfig>;
  return {
    provider: typeof block.provider === 'string' ? block.provider : 'none',
    body: block.body === 'full' ? 'full' : 'minimal',
    target: block.target,
    defaultAssignee: block.defaultAssignee,
  };
}
