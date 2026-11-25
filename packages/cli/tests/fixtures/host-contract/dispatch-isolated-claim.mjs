// Controlled-process integration probe, NOT a model/native/calibration receipt.
import process from 'node:process';

import { dispatchWiringClaim } from '../../helpers/codex-wiring-dispatch.ts';
const locations = JSON.parse(process.argv[2]);
const dispatch = dispatchWiringClaim(
  { ...locations, environment: process.env },
  '{"claim":true}\n',
  [{ agent: 'claude', confirmed: { provider: 'anthropic', model: 'claude-opus-5' } }],
);
process.stdout.write(JSON.stringify(dispatch.read()));
