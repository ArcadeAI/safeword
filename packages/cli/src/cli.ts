#!/usr/bin/env node

import process from 'node:process';

import { runCli } from './cli-protocol/program.js';

await runCli(process.argv);
