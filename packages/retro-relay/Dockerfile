FROM oven/bun:1.3.14 AS build

WORKDIR /workspace
COPY package.json bun.lock tsconfig.json ./
COPY packages/cli/package.json packages/cli/package.json
COPY packages/retro-relay/package.json packages/retro-relay/package.json
COPY packages/website/package.json packages/website/package.json
RUN bun install --frozen-lockfile --ignore-scripts

COPY packages/retro-relay packages/retro-relay
RUN bun run --cwd packages/retro-relay build

FROM node:22.22.3-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app
COPY packages/retro-relay/package.json package.json
RUN apt-get update \
  && apt-get install -y --no-install-recommends g++ make python3 \
  && npm install --omit=dev --no-audit --no-fund --build-from-source \
  && rm -f node_modules/better-sqlite3/prebuilds/linux*.node \
  && npm rebuild better-sqlite3 --build-from-source \
  && apt-get purge -y --auto-remove g++ make python3 \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /workspace/packages/retro-relay/dist dist

CMD ["node", "dist/main.js"]
