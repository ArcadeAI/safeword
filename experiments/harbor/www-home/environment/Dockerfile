FROM node:24-bookworm
RUN npm install -g bun@1.4.4 @anthropic-ai/claude-code@2.1.326
WORKDIR /app
ADD snapshot.tar.gz /app/
RUN bun install --frozen-lockfile --ignore-scripts && bunx --no-install playwright install --with-deps chromium
RUN git init -b main && printf 'node_modules/\n.astro/\ndist/\n' >> .git/info/exclude && \
    git add -A && git -c user.name=Harbor -c user.email=fixture@example.invalid commit -qm "Frozen fixture"
