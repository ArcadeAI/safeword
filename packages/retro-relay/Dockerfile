FROM oven/bun:1.3.14 AS build

WORKDIR /workspace
COPY package.json bun.lock tsconfig.json ./
COPY packages/cli/package.json packages/cli/package.json
COPY packages/retro-relay/package.json packages/retro-relay/package.json
COPY packages/website/package.json packages/website/package.json
RUN bun install --frozen-lockfile --ignore-scripts

COPY packages/retro-relay packages/retro-relay
RUN bun run --cwd packages/retro-relay build

FROM node:24.18.0-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends gosu \
  && rm -rf /var/lib/apt/lists/*
COPY packages/retro-relay/package.json package.json
COPY --from=build /workspace/packages/retro-relay/dist dist
COPY packages/retro-relay/scripts/container-entrypoint.sh /usr/local/bin/relay-entrypoint
RUN chmod 0755 /usr/local/bin/relay-entrypoint

ENTRYPOINT ["relay-entrypoint"]
CMD ["node", "dist/main.js"]
