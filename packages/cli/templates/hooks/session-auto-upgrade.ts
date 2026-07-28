#!/usr/bin/env bun
// Safeword: retired Claude auto-upgrade compatibility entrypoint.
// Session hooks never install, upgrade, or access the network.

import process from 'node:process';

process.exit(0);
