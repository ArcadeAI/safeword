FROM oven/bun:1.3.14@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4 AS build

WORKDIR /workspace
COPY package.json bun.lock tsconfig.json ./
COPY packages/cli/package.json packages/cli/package.json
COPY packages/retro-collector/package.json packages/retro-collector/package.json
COPY packages/retro-relay/package.json packages/retro-relay/package.json
COPY packages/website/package.json packages/website/package.json
RUN bun install --frozen-lockfile --ignore-scripts

COPY packages/retro-relay packages/retro-relay
RUN bun run --cwd packages/retro-relay build

FROM debian:bookworm-slim@sha256:7b140f374b289a7c2befc338f42ebe6441b7ea838a042bbd5acbfca6ec875818 AS runtime

ENV NODE_ENV=production
WORKDIR /app
ARG DEBIAN_SNAPSHOT=20260728T000000Z
ARG NODE_VERSION=24.18.1
ARG TARGETARCH
RUN rm -f /etc/apt/sources.list.d/debian.sources \
  && echo "deb [check-valid-until=no] http://snapshot.debian.org/archive/debian/${DEBIAN_SNAPSHOT}/ bookworm main" > /etc/apt/sources.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl gosu=1.14-1+b10 xz-utils \
  && case "${TARGETARCH}" in \
    amd64) node_arch=x64; node_sha=d6c664df3f3f61458e8c277585571328522d705166723a7c7823a9253a4d15a0 ;; \
    arm64) node_arch=arm64; node_sha=7201e3a09dc825bac57867c81913e2b8f0ef87d04cb9082af4cda82f6ff3d88c ;; \
    *) echo "unsupported architecture: ${TARGETARCH}" >&2; exit 1 ;; \
  esac \
  && node_archive="node-v${NODE_VERSION}-linux-${node_arch}.tar.xz" \
  && curl --fail --location --output "/tmp/${node_archive}" "https://nodejs.org/dist/v${NODE_VERSION}/${node_archive}" \
  && echo "${node_sha}  /tmp/${node_archive}" | sha256sum --check --strict - \
  && tar --extract --xz --file "/tmp/${node_archive}" --directory /usr/local --strip-components=1 \
  && rm -f "/tmp/${node_archive}" \
  && groupadd --gid 1000 node \
  && useradd --uid 1000 --gid node --home-dir /home/node --create-home --shell /bin/sh node \
  && apt-get purge -y --auto-remove curl xz-utils \
  && rm -rf /var/lib/apt/lists/*
COPY packages/retro-relay/package.json package.json
COPY --from=build /workspace/packages/retro-relay/dist dist
COPY packages/retro-relay/scripts/container-entrypoint.sh /usr/local/bin/relay-entrypoint
RUN chmod 0755 /usr/local/bin/relay-entrypoint

ENTRYPOINT ["relay-entrypoint"]
CMD ["node", "dist/main.js"]
