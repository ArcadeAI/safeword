FROM node:22-bookworm AS fixture
RUN npm install -g bun@1.4.4 @anthropic-ai/claude-code@2.1.326
WORKDIR /app
ADD snapshot.tar.gz /app/
RUN bun install --frozen-lockfile --ignore-scripts && git init -b main && \
    git add -A && git -c user.name=Harbor -c user.email=fixture@example.invalid commit -qm "Frozen fixture"

FROM fixture AS treatment
COPY treatment-package.json /app/package.json
COPY treatment-bun.lock /app/bun.lock
RUN bun install --frozen-lockfile --ignore-scripts && \
    test "$(bun -p 'require("./node_modules/safeword/package.json").version')" = 1.1.0

FROM fixture AS baseline
