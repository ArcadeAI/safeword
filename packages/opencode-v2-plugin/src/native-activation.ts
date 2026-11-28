import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';

import { publishConformanceAttempt } from '../../cli/src/host-contract/conformance-run.js';
import {
  openCodeV2NativeBinding,
  openCodeV2NativeStore,
  readOpenCodeV2Enrollment,
} from '../../cli/src/opencode/v2-enrollment.js';
import type { OPENCODE_V2_PLUGIN_LAYOUT } from '../../cli/src/schema.js';
import { type NativeParent, readNativeParent } from './native-parent.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');

function sameNativeServer(facts: NativeParent): boolean {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- current process executable, never caller input
  const executable = realpathSync(process.execPath);
  return (
    facts.serverPid === process.pid &&
    facts.parentPid === process.ppid &&
    facts.parentPid > 1 &&
    facts.serverExecutable === executable &&
    facts.parentExecutable === executable &&
    isDeepStrictEqual(facts.serverArguments, ['serve', '--stdio', '--port', '0'])
  );
}
function optionValue(flag: string, args: string[]): boolean {
  const value = args.shift();
  return !!value && !value.startsWith('-') && (flag !== '--format' || value === 'json');
}
function consumeArgument(
  flag: string,
  args: string[],
  cli: boolean,
  state: { prompt: boolean },
): boolean {
  if (flag === '--standalone' || flag === '--auto') return true;
  const valued = cli ? ['--model', '--format'] : ['--model', '--format', '--prompt'];
  if (valued.includes(flag)) {
    if (!optionValue(flag, args)) return false;
    if (flag === '--prompt') state.prompt = true;
    return true;
  }
  if (!cli || flag.startsWith('-') || state.prompt) return false;
  state.prompt = true;
  return true;
}
function knownLaunch(args: string[], cli: boolean): boolean {
  const seen = new Set<string>();
  const state = { prompt: false };
  while (args.length > 0) {
    const flag = args.shift() ?? '';
    if (seen.has(flag) || !consumeArgument(flag, args, cli, state)) return false;
    seen.add(flag);
  }
  return seen.has('--standalone') && state.prompt;
}
/** Dedicated standalone launches only. Unknown flags/topology never imply a runtime. */
export function dedicatedRuntime(facts: NativeParent | undefined): 'CLI' | 'TUI' | 'unknown' {
  if (!facts || !sameNativeServer(facts)) return 'unknown';
  const args = [...facts.parentArguments];
  const cli = args[0] === 'run';
  if (cli) args.shift();
  if (!knownLaunch(args, cli)) return 'unknown';
  return cli ? 'CLI' : 'TUI';
}

/** The real enrolled tool event owns activation; controller fixtures cannot activate its target. */
export function observeNativeActivation(
  target: {
    profile: string;
    project: string;
    packageDirectory: string;
    version: string;
    layout: typeof OPENCODE_V2_PLUGIN_LAYOUT;
  },
  session: string,
): void {
  const { profile, project, packageDirectory, version, layout } = target;
  try {
    const enrollment = readOpenCodeV2Enrollment(profile, project, packageDirectory, layout);
    if (!enrollment || !session) return;
    const identity = openCodeV2NativeBinding(enrollment, version);
    const facts = readNativeParent();
    const runtime = dedicatedRuntime(facts);
    const current = readOpenCodeV2Enrollment(profile, project, packageDirectory, layout);
    if (!current || !isDeepStrictEqual(identity, openCodeV2NativeBinding(current, version))) return;
    publishConformanceAttempt(openCodeV2NativeStore(identity, layout.activation), {
      identity,
      runtime,
      event: 'pre_tool',
      observed_at: new Date().toISOString(),
      session_id_sha256: hash(session),
      outcome: runtime === 'unknown' ? 'unavailable' : 'observed',
      // No prompts, full argv, credentials or customer tool inputs are retained.
      origin_sha256:
        facts &&
        hash(JSON.stringify([facts.serverPid, facts.parentPid, facts.serverExecutable, runtime])),
      ...(runtime === 'unknown' && { reason: 'dedicated-native-parent-unavailable' }),
    });
  } catch (error) {
    // Observation failure cannot turn an unobserved host into an active one or bypass dispatch.
    console.error(
      'Safeword native activation unavailable:',
      error instanceof Error ? error.message : 'observation failed',
    );
    return;
  }
}
