/**
 * Lazy ESLint config array helper.
 *
 * Wraps a builder function in a Proxy that delays execution until the array is
 * first accessed (read, iterated, spread, or `in`-tested). The result is cached
 * so subsequent accesses don't re-run the builder.
 *
 * Why: stack-specific ESLint plugins (Storybook, Turbo, Astro, etc.) cost
 * ~20ms each to load. The customer's generated `eslint.config.mjs` already
 * conditionally spreads these configs behind `detect.has*(deps)`, so plugins
 * for stacks the customer doesn't use should never load. This helper makes
 * that true — without changing the public shape of `xConfig` exports.
 *
 * Ticket H150ZW.
 */

/**
 * Wrap a builder so its execution is deferred until the returned array is accessed.
 *
 * The returned value is a `Proxy<T[]>` that behaves as the eventual array for
 * read, iterate, spread, `in`, and `Object.keys` operations. Mutation traps are
 * not forwarded (configs are read-only by contract).
 */
export function lazyConfigArray<T>(builder: () => T[]): T[] {
  let cached: T[] | undefined;
  const resolve = (): T[] => (cached ??= builder());

  return new Proxy([] as T[], {
    get(_target, property, _receiver) {
      return Reflect.get(resolve(), property);
    },
    has(_target, property) {
      return Reflect.has(resolve(), property);
    },
    ownKeys(_target) {
      return Reflect.ownKeys(resolve());
    },
    getOwnPropertyDescriptor(_target, property) {
      return Reflect.getOwnPropertyDescriptor(resolve(), property);
    },
  });
}
