import assert from 'node:assert/strict';
import nodePath from 'node:path';

import {
  completeExecOutputMatches,
  outputText,
} from '../../scripts/check-codex-internal-reference.js';
import type { CliResult } from '../../src/cli-protocol/result.js';
import type { ReviewerOutput } from '../../src/review/contract.js';
import {
  parseShellCommandList,
  parseShellWords,
} from '../../templates/hooks/lib/shell-segments.js';
import { readCommands } from './codex-literal-root-read.js';
import { directExecRender, directExecWorkdir, pairedExecOutput } from './codex-parallel-read.js';
import type { NativeTurn } from './codex-workflow-observation.js';

const unavailable = 'HOST_CONTRACT_PROOF_UNAVAILABLE: authenticated current review evidence';
const reviewFiles = ['clamp.js', 'clamp.test.js'];
interface ReviewData {
  review_id: string;
  review_kind: string;
  review_targets: string[];
  status: string;
  actual_reviewer: string;
  reviewer_model: string;
  reviewer_output: ReviewerOutput;
}

function reviewData(status: CliResult, project?: string): ReviewData {
  const data = status.data as ReviewData;
  assert.ok(data && /^[\da-f-]{36}$/u.test(data.review_id), unavailable);
  assert.equal(data.review_kind, 'quality-review', unavailable);
  assert.deepEqual(
    data.review_targets
      .map(
        target =>
          reviewFiles.find(
            file =>
              target === file || (project !== undefined && target === nodePath.join(project, file)),
          ) ?? target,
      )
      .toSorted((a, b) => a.localeCompare(b)),
    reviewFiles,
    unavailable,
  );
  assert.ok(
    data.actual_reviewer && data.reviewer_model && data.reviewer_output?.dispatch_id,
    unavailable,
  );
  assert.equal(data.actual_reviewer, data.reviewer_output.reviewer_agent, unavailable);
  const approved = data.status === 'approved';
  assert.ok(approved || data.status === 'changes_requested', unavailable);
  assert.equal(status.state, approved ? 'healthy' : 'action_required', unavailable);
  assert.equal(data.reviewer_output.verdict, approved ? 'approve' : 'request_changes', unavailable);
  return data;
}

/** Input status MUST come from the installed CLI's normal authenticated status query,
 * for a job absent before this arm. Raw job JSON and model prose are never authority.
 */
export function correlatedReview(
  turn: NativeTurn,
  runtime: string,
  status: CliResult,
  project?: string,
) {
  const data = reviewData(status, project);
  const matches = turn.events.filter(event => completedReview(event, runtime, data, project));
  assert.ok(matches.length > 0, unavailable);
  for (const event of matches) {
    assert.ok(event.item, unavailable);
    const command = event.item.command ?? '';
    const shell = nativeShellCommand(command);
    assert.ok(shell, unavailable);
    const needsCwd = observedCwdRequired(shell);
    if (needsCwd) assert.ok(project, unavailable);
    const callId = correlatedCall(turn, shell, event.item.aggregated_output ?? '', {
      workdir: needsCwd ? project : undefined,
    });
    if (!callId) continue;
    return {
      callId,
      reviewId: data.review_id,
      reviewer: data.actual_reviewer,
      model: data.reviewer_model,
      provenance: status.data,
      output: data.reviewer_output,
    };
  }
  assert.fail(unavailable);
}

/** Decode one fixed native display argument; the sentinel rejects incomplete quoting.
 * The shared tokenizer is not POSIX double-quote escape evaluation. Unsupported
 * escaped spellings cannot correlate unless decoding equals the literal raw tool command.
 */
export function nativeShellCommand(command: string): string | undefined {
  const words = parseShellWords(`${command} SAFEWORD_DISPLAY_END`);
  return words.length === 4 &&
    words[0] === '/bin/zsh' &&
    words[1] === '-lc' &&
    words[3] === 'SAFEWORD_DISPLAY_END'
    ? words[2]
    : undefined;
}

/** Tool provenance for one completed SDK command; no execution or status authority is invented. */
export function correlatedToolCommands(
  turn: Pick<NativeTurn, 'entries'>,
  event: NativeTurn['events'][number],
  completeBody?: string,
): { shell: string; callId: string }[] {
  if (event.type !== 'item.completed' || event.item?.type !== 'command_execution') return [];
  const shell = nativeShellCommand(event.item.command ?? '');
  const output = event.item.aggregated_output;
  if (!shell || !output) return [];
  const callId = correlatedCall(turn, shell, output, {
    unique: true,
    completeBody,
    sdkExit: event.item.exit_code,
  });
  return callId ? [{ shell, callId }] : [];
}

function correlatedCall(
  turn: Pick<NativeTurn, 'entries'>,
  shell: string,
  output: string,
  options: { unique?: boolean; completeBody?: string; workdir?: string; sdkExit?: number } = {},
): string | undefined {
  const { unique = false, completeBody, workdir } = options;
  const outputs = turn.entries.filter(
    item =>
      item.type === 'response_item' &&
      ['custom_tool_call_output', 'function_call_output'].includes(item.payload?.type ?? ''),
  );
  let match: string | undefined;
  for (const candidate of outputs) {
    const observed = candidate.payload;
    assert.ok(observed, unavailable);
    if (!rawOutputCandidate(observed.output, completeBody ?? output)) continue;
    const correlated = uniqueCandidateCall(turn, candidate, outputs, {
      shell,
      output,
      completeBody,
      sdkExit: options.sdkExit,
    });
    if (!correlated) continue;
    if (!calledCommand(correlated.entry, shell, workdir)) continue;
    assert.ok(
      !unique || match === undefined,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: ambiguous identical tool observations',
    );
    match ??= correlated.callId;
  }
  return match;
}

function rawOutputCandidate(raw: unknown, needle: string): boolean {
  const text = outputText(raw);
  return text.includes(needle) || text.includes(JSON.stringify(needle).slice(1, -1));
}

interface ExecObservation {
  shell: string;
  output: string;
  completeBody?: string;
  sdkExit?: number;
}

function uniqueCandidateCall(
  turn: Pick<NativeTurn, 'entries'>,
  candidate: NativeTurn['entries'][number],
  outputs: NativeTurn['entries'],
  expected: ExecObservation,
) {
  const observed = candidate.payload;
  assert.ok(observed?.call_id, unavailable);
  const kind = observed?.type === 'function_call_output' ? 'function_call' : 'custom_tool_call';
  const calls = turn.entries.filter(
    item =>
      item.type === 'response_item' &&
      item.payload?.type === kind &&
      item.payload.call_id === observed?.call_id,
  );
  assert.equal(calls.length, 1, unavailable);
  const entry = calls[0];
  assert.ok(entry?.payload?.call_id, unavailable);
  assert.equal(
    outputs.filter(
      item => item.payload?.type === observed?.type && item.payload?.call_id === observed?.call_id,
    ).length,
    1,
    unavailable,
  );
  return correlatedOutput(observed.output, expected, entry)
    ? { entry, callId: entry.payload.call_id }
    : undefined;
}

function correlatedOutput(
  raw: unknown,
  expected: ExecObservation,
  entry: NativeTurn['entries'][number],
): boolean {
  const { output, completeBody, sdkExit } = expected;
  if (!completeBody) return outputText(raw, true).includes(output);
  const input = toolInput(entry);
  const paired = pairedMatch(input, expected, raw, completeBody);
  if (paired !== undefined) return paired;
  if (completeExecOutputMatches(raw, output, completeBody)) return true;
  if (sdkExit !== 0 || !output.includes(completeBody)) return false;
  if (input === undefined) return false;
  if (!readCommands(input).includes(expected.shell)) return false;
  const rendered = directExecRender(input, expected.shell, output, sdkExit);
  return rendered !== undefined && completeExecOutputMatches(raw, rendered, completeBody);
}

function pairedMatch(
  input: string | undefined,
  expected: ExecObservation,
  raw: unknown,
  body: string,
): boolean | undefined {
  if (input === undefined) return;
  const paired = pairedExecOutput(input, expected.shell, raw);
  if (paired === undefined) return;
  return expected.sdkExit === 0 && paired === expected.output && paired.includes(body);
}

function calledCommand(
  entry: NativeTurn['entries'][number],
  shell: string,
  workdir?: string,
): boolean {
  const input = toolInput(entry);
  if (input === undefined) return false;
  return (
    readCommands(input).includes(shell) &&
    (workdir === undefined || directExecWorkdir(input, shell) === workdir)
  );
}

function toolInput(entry: NativeTurn['entries'][number]): string | undefined {
  if (entry.type !== 'response_item') return;
  const item = entry.payload;
  if (!['custom_tool_call', 'function_call'].includes(item?.type ?? '')) return;
  const input = item?.type === 'function_call' ? item.arguments : item?.input;
  return typeof input === 'string' ? input : undefined;
}

function observedCwdRequired(shell: string): boolean {
  const segments = parseShellCommandList(shell);
  const recipe = reviewInvocation(segments.at(-1)?.command ?? '');
  return (
    preparationCwdRequired(segments) ||
    segments.some(part => part.command === 'PROJECT_DIR="$PWD"') ||
    recipe?.latestStatus === true ||
    boundRunCwd(recipe?.boundCwd, shell) ||
    recipe?.boundFiles === true
  );
}

function boundRunCwd(bound: boolean | undefined, shell: string): boolean {
  return bound === true && /\breview[ \t]+run[ \t]+quality-review\b/u.test(shell);
}

function preparationCwdRequired(segments: ReturnType<typeof parseShellCommandList>): boolean {
  const start = configInspectionPrefix(segments[0]?.command ?? '') ? 1 : 0;
  return segments.slice(start).some(part => staticPreparation(part.command) === 'process');
}

function completedReview(
  event: NativeTurn['events'][number],
  runtime: string,
  data: ReviewData,
  project?: string,
): boolean {
  if (event.type !== 'item.completed' || event.item?.type !== 'command_execution') return false;
  const item = event.item;
  const shell = nativeShellCommand(item.command ?? '');
  if (item.exit_code !== reviewExit(shell, data.status)) return false;
  if (shell === undefined) return false;
  const completedZero = item.exit_code === 0;
  const command = isTestedReviewCommand(shell, runtime, project, completedZero)
    ? { configInspection: false }
    : reviewCommand(shell, runtime, data.review_id, project, completedZero);
  return (
    command !== undefined && sameReview(item.aggregated_output, data, command.configInspection)
  );
}

function reviewExit(shell: string | undefined, status: string): number {
  if (status === 'approved') return 0;
  return shell?.includes(' review run quality-review ') && /\s--agent-handoff(?:\s|$)/u.test(shell)
    ? 0
    : 2;
}

function sameReview(
  output: string | undefined,
  expected: unknown,
  configInspection: boolean,
): boolean {
  try {
    const result = JSON.parse(reviewResultText(output ?? '', configInspection)) as CliResult;
    assert.deepEqual(result.data, expected);
    return true;
  } catch {
    return false;
  }
}

function reviewResultText(output: string, configInspection: boolean): string {
  const finalLine = output.trim().split('\n').at(-1) ?? '';
  if (!configInspection) return finalLine;
  // Two independent outputs may touch without a newline. Frame only this known
  // result envelope after one complete config object, never an arbitrary stream.
  const boundary = output.lastIndexOf('{"schema_version":1,"ok":');
  if (boundary === -1) return finalLine;
  const prefix = output.slice(0, boundary).trim();
  if (!prefix) return finalLine;
  const config: unknown = JSON.parse(prefix);
  assert.ok(config !== null && typeof config === 'object' && !Array.isArray(config));
  return output.slice(boundary);
}

/** Only the observed literal packaged-runtime form; no shell evaluation or general grammar. */
function reviewCommand(
  command: string,
  runtime: string,
  id: string,
  project: string | undefined,
  completedZero: boolean,
): { configInspection: boolean } | undefined {
  const segments = parseShellCommandList(command);
  const invocation = segments.pop();
  if (!invocation || ![undefined, ';'].includes(invocation.operatorAfter)) return;
  const configInspection = configInspectionPrefix(segments[0]?.command ?? '');
  if (configInspection && segments.shift()?.operatorAfter !== ';') return;
  const recipe = reviewInvocation(invocation.command, id);
  if (
    !recipe ||
    !currentReviewBindings(
      segments,
      runtime,
      project,
      [configInspection, recipe.boundCwd, recipe.boundFiles].includes(true),
      { completedZero, allowEarlyCd: recipe.latestStatus },
    )
  )
    return;
  return { configInspection };
}

function isTestedReviewCommand(
  command: string,
  runtime: string,
  project: string | undefined,
  completedZero: boolean,
): boolean {
  if (!completedZero) return false;
  if (!project || [runtime, project].some(value => !/^\/[\w./-]+$/u.test(value))) return false;
  return (
    command ===
    `SAFEWORD_PLUGIN_RUNTIME='${runtime}'; export SAFEWORD_PLUGIN_RUNTIME; cd ${project} && node --version && npm test && SAFEWORD_REVIEW_PROGRESS=1 bun "$SAFEWORD_PLUGIN_RUNTIME" review run quality-review --agent-handoff --json -- clamp.js clamp.test.js`
  );
}

function configInspectionPrefix(command: string): boolean {
  if (/[$`\\]/u.test(command)) return false;
  return (
    JSON.stringify(parseShellWords(command)) ===
    JSON.stringify(['sed', '-n', '1,220p', '.safeword/config.json'])
  );
}

function currentReviewBindings(
  segments: ReturnType<typeof parseShellCommandList>,
  runtime: string,
  project: string | undefined,
  requireProject: boolean,
  options: { completedZero: boolean; allowEarlyCd: boolean },
): boolean {
  // The tool's cwd and complete current status are independently checked.
  // The final status does not prove that an earlier child succeeded.
  const hasEarlyCd = normalizeEarlyCd(segments, runtime, project, options);
  if (hasEarlyCd === undefined) return false;
  const cd = segments.at(-1)?.command === 'cd "$PROJECT_DIR"';
  if (cd && segments.pop()?.operatorAfter !== '&&') return false;
  const preparations = segments.map((_part, index) => preparationClass(segments, index));
  if (!preparationOperators(segments, preparations, options.completedZero)) return false;
  const assignments = segments.filter((_part, index) => preparations[index] === undefined);
  if (![1, 2].includes(assignments.length)) return false;
  const bindings = literalBindings(assignments, project);
  return (
    bindings !== undefined &&
    validBindings(bindings, runtime, project, [cd, hasEarlyCd, requireProject].includes(true))
  );
}

function normalizeEarlyCd(
  segments: ReturnType<typeof parseShellCommandList>,
  runtime: string,
  project: string | undefined,
  options: { completedZero: boolean; allowEarlyCd: boolean },
): boolean | undefined {
  const earlyCd = segments.findIndex(part => part.command === 'cd "$PROJECT_DIR"');
  if (segments.filter(part => part.command === 'cd "$PROJECT_DIR"').length > 1) return;
  if (earlyCd === -1 || earlyCd === segments.length - 1) return false;
  if (!options.allowEarlyCd || !options.completedZero) return;
  if (!validEarlyCd(segments, earlyCd, runtime, project)) return;
  segments.splice(earlyCd, 1);
  return true;
}

function validEarlyCd(
  segments: ReturnType<typeof parseShellCommandList>,
  index: number,
  runtime: string,
  project: string | undefined,
): boolean {
  const head = segments.slice(0, index);
  const bindings = literalBindings(head, project);
  return (
    segments[index]?.operatorAfter === '&&' &&
    head.length === 2 &&
    head.every(part => part.operatorAfter === ';') &&
    bindings !== undefined &&
    validBindings(bindings, runtime, project, true) &&
    segments.slice(index + 1).some(part => staticPreparation(part.command) === 'process')
  );
}

// Conservative union of zsh-5.9 core, optional/module builtins and reserved words.
// Tagged vendor census digest is checked independently in the boundary tests.
// These names classify parent language, never actual resolution or child safety.
export const preparationLanguageNames = [
  '!',
  '-',
  '.',
  ':',
  '[',
  '[[',
  'alias',
  'autoload',
  'bg',
  'bindkey',
  'break',
  'builtin',
  'bye',
  'cap',
  'case',
  'cd',
  'chdir',
  'chgrp',
  'chmod',
  'chown',
  'clone',
  'command',
  'compadd',
  'comparguments',
  'compcall',
  'compctl',
  'compdescribe',
  'compfiles',
  'compgroups',
  'compquote',
  'compset',
  'comptags',
  'comptry',
  'compvalues',
  'continue',
  'coproc',
  'declare',
  'dirs',
  'disable',
  'disown',
  'do',
  'done',
  'echo',
  'echotc',
  'echoti',
  'elif',
  'else',
  'emulate',
  'enable',
  'end',
  'esac',
  'eval',
  'example',
  'exec',
  'exit',
  'export',
  'false',
  'fc',
  'fg',
  'fi',
  'float',
  'for',
  'foreach',
  'function',
  'functions',
  'getcap',
  'getln',
  'getopts',
  'hash',
  'hashinfo',
  'history',
  'if',
  'integer',
  'jobs',
  'kill',
  'let',
  'limit',
  'ln',
  'local',
  'log',
  'logout',
  'mem',
  'mkdir',
  'mv',
  'nocorrect',
  'noglob',
  'patdebug',
  'pcre_compile',
  'pcre_match',
  'pcre_study',
  'popd',
  'print',
  'printf',
  'private',
  'pushd',
  'pushln',
  'pwd',
  'r',
  'read',
  'readonly',
  'rehash',
  'repeat',
  'return',
  'rm',
  'rmdir',
  'sched',
  'select',
  'set',
  'setcap',
  'setopt',
  'shift',
  'source',
  'stat',
  'strftime',
  'suspend',
  'sync',
  'syserror',
  'sysopen',
  'sysread',
  'sysseek',
  'syswrite',
  'test',
  'then',
  'time',
  'times',
  'trap',
  'true',
  'ttyctl',
  'type',
  'typeset',
  'ulimit',
  'umask',
  'unalias',
  'unfunction',
  'unhash',
  'unlimit',
  'unset',
  'unsetopt',
  'until',
  'vared',
  'wait',
  'whence',
  'where',
  'which',
  'while',
  'zcompile',
  'zcurses',
  'zdelattr',
  'zf_chgrp',
  'zf_chmod',
  'zf_chown',
  'zf_ln',
  'zf_mkdir',
  'zf_mv',
  'zf_rm',
  'zf_rmdir',
  'zf_sync',
  'zformat',
  'zftp',
  'zgdbmpath',
  'zgetattr',
  'zle',
  'zlistattr',
  'zmodload',
  'zparseopts',
  'zprof',
  'zpty',
  'zregexparse',
  'zselect',
  'zsetattr',
  'zsocket',
  'zstat',
  'zstyle',
  'zsystem',
  'ztcp',
  'ztie',
  'zuntie',
  '{',
  '}',
];
const preparationLanguageSet = new Set(preparationLanguageNames);

export const preparationLanguageProbe =
  'zmodload zsh/parameter || exit 1; print -r -- "$ZSH_VERSION"; ' +
  'print -rl -- ${(k)builtins} ${(k)dis_builtins} $reswords $dis_reswords';

export function checkedPreparationLanguage(output: string): { version: string; names: string[] } {
  const [version, ...names] = output.replace(/\n$/u, '').split('\n');
  assert.ok(
    version === '5.9' && names.length > 0 && names.every(name => preparationLanguageSet.has(name)),
    'HOST_CONTRACT_PROOF_UNAVAILABLE: shell language applicability',
  );
  return { version, names };
}

// Observe literal child argv, not its purpose or safety. Shell expansions and
// escapes outside single quotes are unsupported; the original data stays intact.
const preparationWords = /^(?:[\w./:=,@%+\t -]|'[^']*'|"[^"$`\\]*")+$/u;
type Preparation = 'process' | 'label' | 'tolerance' | undefined;
function staticPreparation(command: string): Preparation {
  // One fixed format and one plain literal label; not arbitrary output/JSON echo.
  if (/^printf[ \t]+(?:'%s\\n'|"%s\\n")[ \t]+(?:'[\w ./:-]+'|"[\w ./:-]+")$/u.test(command))
    return 'label';
  if (/^printf[ \t]+'(?!-)(?:[\w ./:-]|\\n|\\\\)+'$/u.test(command)) return 'label';
  if (!preparationWords.test(command)) return undefined;
  // Quoted equals is argv data; bare equals invokes zsh executable expansion.
  if (/(?:^|[ \t])=/u.test(command.replaceAll(/'[^']*'|"[^"]*"/gu, '_'))) return undefined;
  const program = parseShellWords(command)[0] ?? '';
  return /^[A-Za-z_][\w.-]*(?:[ \t]|$)/u.test(command) && !preparationLanguageSet.has(program)
    ? 'process'
    : undefined;
}

function preparationClass(
  segments: ReturnType<typeof parseShellCommandList>,
  index: number,
): Preparation {
  const part = segments[index];
  if (!part) return undefined;
  const previous = segments[index - 1];
  if (
    part.command === 'true' &&
    part.operatorAfter === ';' &&
    previous?.operatorAfter === '||' &&
    staticPreparation(previous.command) === 'process'
  )
    return 'tolerance';
  return staticPreparation(part.command);
}

function preparationOperators(
  segments: ReturnType<typeof parseShellCommandList>,
  preparations: Preparation[],
  completedZero: boolean,
): boolean {
  // The validated final review/cd tail is an eligible endpoint, not a new preparation class.
  const processEdges = [...preparations, 'process'].map(
    preparation => completedZero && preparation === 'process',
  );
  return segments.every((part, index) => {
    switch (part.operatorAfter) {
      case '|': {
        return preparations[index] === 'process' && preparations[index + 1] === 'process';
      }
      case '||': {
        return preparations[index] === 'process' && preparations[index + 1] === 'tolerance';
      }
      case undefined:
      case ';': {
        return true;
      }
      case '&&': {
        // Nonzero may come from a child while the final review never ran.
        // The last edge leads only to the already validated review/cd tail.
        return processEdges.slice(index, index + 2).every(Boolean);
      }
      case '&':
      case '|&': {
        return false;
      }
    }
  });
}

function reviewInvocation(
  invocation: string,
  id?: string,
): { latestStatus: boolean; boundCwd: boolean; boundFiles: boolean } | undefined {
  const match =
    /^(?:SAFEWORD_REVIEW_PROGRESS=1[ \t]+)?bun[ \t]+"\$SAFEWORD_PLUGIN_RUNTIME"[ \t]+review[ \t]+(run quality-review|status)(?=[ \t]|$)([^\r\n]*)$/u.exec(
      invocation,
    );
  if (!match) return;
  const tail = reviewArguments(match[2] ?? '');
  if (!tail) return;
  if (match[1] === 'run quality-review') {
    if (!tail.boundCwd) return { ...tail, latestStatus: false };
    if (tail.args === '--context package.json --agent-handoff --json -- clamp.js clamp.test.js')
      return { ...tail, latestStatus: false };
    return;
  }
  if (tail.boundFiles) return;
  const latestStatus = tail.args === '--json';
  if (latestStatus || explicitStatusId(tail.args, id)) return { ...tail, latestStatus };
  return undefined;
}

function reviewArguments(
  tail: string,
): { args: string; boundCwd: boolean; boundFiles: boolean } | undefined {
  const cwd = tail.replace(/[ \t]--cwd[ \t]+"\$PROJECT_DIR"(?=[ \t]|$)/u, '');
  // Only exact quoted fixed-file tokens are compared as relative spellings.
  // The original shell/status stay untouched; current bindings and tool cwd are
  // independently checked before this command can supply any evidence.
  const normalized = cwd.replaceAll(
    /"\$PROJECT_DIR\/(package\.json|clamp(?:\.test)?\.js)"/gu,
    '$1',
  );
  if (!/^[\w./ =-]*$/u.test(normalized)) return;
  if (parseShellWords(normalized).some(word => word.startsWith('--cwd'))) return;
  const boundFiles = normalized !== cwd;
  if (boundFiles && !fixedFileArguments(parseShellWords(normalized))) return;
  return { args: normalized.trim(), boundCwd: cwd !== tail, boundFiles };
}

function fixedFileArguments(words: string[]): boolean {
  const separator = words.indexOf('--');
  if (
    separator === -1 ||
    JSON.stringify(words.slice(separator + 1).toSorted((a, b) => a.localeCompare(b))) !==
      JSON.stringify(reviewFiles)
  )
    return false;
  const options = words.slice(0, separator);
  const context = options.indexOf('--context');
  if (context === -1 || options[context + 1] !== 'package.json') return false;
  options.splice(context, 2);
  const flags = options.toSorted((a, b) => a.localeCompare(b)).join(' ');
  return flags === '--json' || flags === '--agent-handoff --json';
}

function explicitStatusId(args: string, id?: string): boolean {
  return id !== undefined && args.split(/\s+/u, 1)[0] === id;
}

function validBindings(
  bindings: Map<string, string>,
  runtime: string,
  project?: string,
  requireProject = false,
): boolean {
  return (
    bindings.get('SAFEWORD_PLUGIN_RUNTIME') === runtime &&
    (!requireProject || (project !== undefined && bindings.has('PROJECT_DIR'))) &&
    (!bindings.has('PROJECT_DIR') || bindings.get('PROJECT_DIR') === project)
  );
}

function literalBindings(
  segments: ReturnType<typeof parseShellCommandList>,
  project?: string,
): Map<string, string> | undefined {
  const bindings = new Map<string, string>();
  for (const part of segments) {
    const command =
      part.command === 'PROJECT_DIR="$PWD"' && project !== undefined
        ? `PROJECT_DIR='${project}'`
        : part.command;
    const binding =
      /^(SAFEWORD_PLUGIN_RUNTIME|PROJECT_DIR)=(?:'([/\w.-]+)'|"([/\w.-]+)"|([/\w.-]+))$/u.exec(
        command,
      );
    if (!binding?.[1] || bindings.has(binding[1])) return undefined;
    bindings.set(binding[1], binding[2] ?? binding[3] ?? binding[4] ?? '');
  }
  return bindings;
}
