import { SAFEWORD_SCHEMA } from '../schema.js';
import { CURSOR_HOOKS } from '../templates/config.js';

/** Projection mechanics only: existing declarations own events and shared policy. */
export function cursorPluginBindings() {
  return Object.entries(CURSOR_HOOKS).flatMap(([event, hooks]) =>
    hooks.map((hook, index) => {
      const match = /^bun \.\/\.safeword\/hooks\/([\w/-]+\.ts)(.*)$/u.exec(hook.command);
      if (!match?.[1]) throw new Error(`Unrecognized canonical Cursor command: ${hook.command}`);
      const template = SAFEWORD_SCHEMA.ownedFiles[`.safeword/hooks/${match[1]}`]?.template;
      if (template !== `hooks/${match[1]}`)
        throw new Error(`Unregistered Cursor hook: ${match[1]}`);
      const tail = match[2]?.trim() ?? '';
      if (tail && !/^[-\w= ]+$/u.test(tail))
        throw new Error(`Unsupported Cursor hook arguments: ${tail}`);
      return {
        id: `${event}:${index}`,
        event,
        path: match[1],
        args: tail ? tail.split(/ +/u) : [],
        configuration: hook,
      };
    }),
  );
}
