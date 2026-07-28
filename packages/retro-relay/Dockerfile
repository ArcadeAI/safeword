FROM oven/bun:1.3.14@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4 AS build

WORKDIR /workspace
COPY package.json bun.lock tsconfig.json ./
COPY packages/cli/package.json packages/cli/package.json
COPY packages/retro-relay/package.json packages/retro-relay/package.json
COPY packages/website/package.json packages/website/package.json
RUN bun install --frozen-lockfile --ignore-scripts

COPY packages/retro-relay packages/retro-relay
RUN bun run --cwd packages/retro-relay build

FROM node:24.18.0-bookworm-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d AS runtime

ENV NODE_ENV=production
WORKDIR /app
ARG DEBIAN_SNAPSHOT=20260728T000000Z
RUN rm -f /etc/apt/sources.list.d/debian.sources \
  && echo "deb [check-valid-until=no] http://snapshot.debian.org/archive/debian/${DEBIAN_SNAPSHOT}/ bookworm main" > /etc/apt/sources.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends gosu=1.14-1+b10 \
  && rm -rf /var/lib/apt/lists/*
COPY packages/retro-relay/package.json package.json
COPY --from=build /workspace/packages/retro-relay/dist dist
COPY packages/retro-relay/scripts/container-entrypoint.sh /usr/local/bin/relay-entrypoint
RUN chmod 0755 /usr/local/bin/relay-entrypoint

ENTRYPOINT ["relay-entrypoint"]
CMD ["node", "dist/main.js"]
