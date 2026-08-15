const vitestRuntime = new URL(
  "../../../packages/cli/node_modules/vitest/dist/index.js",
  import.meta.url
).pathname;

export default {
  resolve: {
    alias: {
      vitest: vitestRuntime,
    },
  },
  root: import.meta.dirname,
  test: {
    environment: "node",
    env: {
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "commit.gpgsign",
      GIT_CONFIG_VALUE_0: "false",
    },
    include: ["*.test.ts"],
    testTimeout: 60_000,
  },
};
