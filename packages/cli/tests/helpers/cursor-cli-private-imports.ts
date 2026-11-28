import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

export function configurePrivateImports(workspace: string, names?: readonly string[]): void {
  if (!names?.length) {
    return;
  }

  const directory = nodePath.join(workspace, '.claude');
  const file = nodePath.join(directory, 'settings.local.json');
  const settings = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  const disabled = Object.fromEntries(names.map(name => [name, false]));
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    file,
    JSON.stringify({
      ...settings,
      enabledPlugins: {
        ...settings.enabledPlugins,
        ...disabled,
      },
    }),
  );
}
