import { expect, it } from 'vitest';

import { intakeShellWriteTargets } from '../../templates/hooks/lib/intake-write-targets.js';

it.each([
  ['printf done >> "app/report file"', ['app/report file']],
  ["cat > app/new-file <<'END'\ncp x imaginary\nEND", ['app/new-file']],
  ['cat app/source | tee -a app/changes', ['app/changes']],
  ['echo ok > app/record # explain | tee imaginary', ['app/record']],
  ["echo '#' >> 'release#1'", ['release#1']],
  ['cat source # sample | tee imaginary', []],
  ['echo ok > facturé.txt', ['facturé.txt']],
  ['sed -i --help source', []],
  ['cp app/source /tmp/snapshot', ['/tmp/snapshot']],
  ['mv app/source /tmp/snapshot', ['/tmp/snapshot', 'app/source']],
  ["sed -i '' 's/typo/fixed/' app/source", ['app/source']],
  ['cat app/source', []],
  ["rg '>' app/source", []],
  ['node tools/update.js', []],
  ['./tools/cp source target', []],
  ['/bin/cp app/source /tmp/snapshot', ['/tmp/snapshot']],
  ['cd other && cp source destination', []],
  ['cat <<END\ncp source destination\nEND', []],
  ['echo ok > "$DEST"', []],
  ['cat app/source 2>&1', []],
] as const)('recognizes literal destinations of %s', (command, expected) => {
  expect(intakeShellWriteTargets(command)).toEqual(expected);
});
