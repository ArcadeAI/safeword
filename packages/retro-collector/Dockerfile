FROM oven/bun:1.3.14@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4 AS build

WORKDIR /workspace
COPY package.json bun.lock tsconfig.json ./
COPY packages/cli/package.json packages/cli/package.json
COPY packages/retro-collector/package.json packages/retro-collector/package.json
COPY packages/retro-relay/package.json packages/retro-relay/package.json
COPY packages/website/package.json packages/website/package.json
RUN bun install --frozen-lockfile --ignore-scripts

COPY packages/retro-collector packages/retro-collector
RUN bun run --cwd packages/retro-collector build

FROM node:24.18.1-bookworm-slim@sha256:235600a8101ab264e117b1768e925532262668dc9b581ef1dd7d96ced463b8e7 AS runtime

ENV NODE_ENV=production
WORKDIR /app
COPY packages/retro-collector/package.json package.json
COPY --from=build /workspace/packages/retro-collector/dist dist

CMD ["node", "dist/main.js"]
