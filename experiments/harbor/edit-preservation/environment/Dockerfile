FROM node:22-bookworm
RUN npm install -g bun@1.4.4 @anthropic-ai/claude-code@2.1.326
WORKDIR /app
COPY *.mjs ./
RUN git init && npm init -y && npm install --save-dev eslint@10.4.0 safeword@1.1.0 jiti@2.6.1 @cucumber/cucumber tsx @types/node prettier publint dependency-cruiser knip
