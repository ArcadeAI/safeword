FROM node:22.23.5-bookworm@sha256:7c400d78797d8cbe3f6bb21d2227b86af4cd24b0014cc9f62ff989cc16de988e
ARG CLAUDE_VERSION
ARG CODEX_VERSION
RUN npm install --global --no-audit --no-fund bun@1.4.4 \
    "@anthropic-ai/claude-code@${CLAUDE_VERSION}" "@openai/codex@${CODEX_VERSION}"
WORKDIR /app
COPY package.json .gitignore ./
RUN npm install --no-save --no-package-lock --no-audit --no-fund \
    @cucumber/cucumber@13.3.0 eslint@10.4.0 jiti@2.6.1 tsx@4.23.15 \
    prettier@3.10.1 publint@0.3.25 knip@6.46.1 dependency-cruiser@18.8.0 @types/node@26.6.6 \
    && git init -q -b main && git add package.json .gitignore \
    && GIT_AUTHOR_DATE=2026-11-24T00:00:00Z GIT_COMMITTER_DATE=2026-11-24T00:00:00Z \
       git -c user.name=Harbor -c user.email=fixture@example.invalid commit -qm 'Create fresh CLI project'
